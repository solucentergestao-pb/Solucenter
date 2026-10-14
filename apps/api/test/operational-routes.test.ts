import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const db=vi.hoisted(()=>({
 serviceOrder:{findFirst:vi.fn(),count:vi.fn(),create:vi.fn(),updateMany:vi.fn(),update:vi.fn()},
 customer:{findFirst:vi.fn()},customerUnit:{findFirst:vi.fn(),findMany:vi.fn(),update:vi.fn()},
 environment:{findFirst:vi.fn()},equipment:{findFirst:vi.fn()},
 serviceType:{findFirst:vi.fn()},user:{count:vi.fn()},
 accountReceivable:{findFirst:vi.fn(),create:vi.fn()},serviceMeasurement:{create:vi.fn()},servicePhoto:{create:vi.fn()},
 quote:{findFirst:vi.fn(),updateMany:vi.fn()},$transaction:vi.fn(),
}));
vi.mock('../src/lib/prisma.js',()=>({prisma:db}));
import {serviceOrderRoutes} from '../src/routes/serviceOrders.js';
import {unitRoutes} from '../src/routes/units.js';
import {quoteRoutes} from '../src/routes/quotes.js';

const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const company='33333333-3333-4333-8333-333333333333';
const principal={id,companyId:company,role:'ADMIN',permissions:[]};
async function request(route:'orders'|'units'|'quotes',method:'GET'|'POST'|'PATCH',url:string,payload?:object,role='ADMIN'){
 const app=Fastify();app.register(jwt,{secret:'isolated-test-secret'});
 app.register(route==='orders'?serviceOrderRoutes:route==='units'?unitRoutes:quoteRoutes);
 await app.ready();
 try{return await app.inject({method,url,payload,headers:{authorization:`Bearer ${app.jwt.sign({...principal,role})}`}})}
 finally{await app.close()}
}
beforeEach(()=>{vi.resetAllMocks();db.$transaction.mockImplementation(async fn=>fn(db));db.serviceOrder.count.mockResolvedValue(0)});

describe('OS: HTTP routes and tenant guards (database mocked)',()=>{
 it.each(['measurements','materials','start','complete','invoice'])('blocks foreign OS before %s writes',async action=>{
  db.serviceOrder.findFirst.mockResolvedValue(null);
  const r=await request('orders','POST',`/${id}/${action}`,{});
  expect(r.statusCode).toBe(404);
  expect(db.serviceOrder.findFirst).toHaveBeenCalledWith({where:{id,companyId:company}});
  expect(db.$transaction).not.toHaveBeenCalled();expect(db.serviceMeasurement.create).not.toHaveBeenCalled();expect(db.servicePhoto.create).not.toHaveBeenCalled();
 });
 it('records measurements for an owned OS and computes deltaT',async()=>{
  db.serviceOrder.findFirst.mockResolvedValue({id});db.serviceOrder.updateMany.mockResolvedValue({count:1});db.serviceMeasurement.create.mockImplementation(async x=>x.data);
  const r=await request('orders','POST',`/${id}/measurements`,{returnTemperature:26,supplyTemperature:14});
  expect(r.statusCode).toBe(201);expect(r.json().deltaT).toBe(12);
 });
 it.each(['COMPLETED','INVOICED','RECEIVED','CANCELLED'])('rejects measurements for %s orders',async status=>{
  db.serviceOrder.findFirst.mockResolvedValue({id,status});db.serviceOrder.updateMany.mockResolvedValue({count:0});
  const r=await request('orders','POST',`/${id}/measurements`,{voltage:220});
  expect(r.statusCode).toBe(409);expect(r.json().error.code).toBe('SERVICE_ORDER_LOCKED');
  expect(db.serviceMeasurement.create).not.toHaveBeenCalled();
 });
 it('rechecks writable status atomically even if the preHandler saw an open order',async()=>{
  db.serviceOrder.findFirst.mockResolvedValue({id,status:'OPEN'});db.serviceOrder.updateMany.mockResolvedValue({count:0});
  const r=await request('orders','POST',`/${id}/measurements`,{voltage:220});
  expect(r.statusCode).toBe(409);expect(db.serviceMeasurement.create).not.toHaveBeenCalled();
  expect(db.serviceOrder.updateMany).toHaveBeenCalledWith({where:{id,companyId:company,status:{in:['OPEN','SCHEDULED','ASSIGNED','ON_THE_WAY','IN_PROGRESS','WAITING_APPROVAL','WAITING_PARTS']}},data:{updatedAt:expect.any(Date)}});
 });
 it('rejects financial edits when an invoice wins after the initial read',async()=>{
  db.serviceOrder.findFirst.mockResolvedValue({id,status:'COMPLETED'});db.serviceOrder.updateMany.mockResolvedValue({count:0});
  const r=await request('orders','PATCH',`/${id}/financials`,{finalValue:200});
  expect(r.statusCode).toBe(409);expect(r.json().error.code).toBe('SERVICE_ORDER_LOCKED');
  expect(db.serviceOrder.updateMany).toHaveBeenCalledWith({where:{id,companyId:company,status:'COMPLETED'},data:expect.objectContaining({finalValue:200})});
 });
 it('invoices the latest value after acquiring the order lock',async()=>{
  db.serviceOrder.findFirst.mockResolvedValueOnce({id,status:'COMPLETED'})
   .mockResolvedValueOnce({id,status:'COMPLETED',finalValue:100})
   .mockResolvedValueOnce({id,status:'INVOICED',finalValue:200});
  db.serviceOrder.updateMany.mockResolvedValue({count:1});
  db.serviceOrder.update.mockResolvedValue({id,status:'INVOICED'});
  db.accountReceivable.findFirst.mockResolvedValue(null);db.accountReceivable.create.mockImplementation(async x=>x.data);
  const r=await request('orders','POST',`/${id}/invoice`,{dueDate:'2026-10-15'});
  expect(r.statusCode).toBe(200);expect(r.json().originalAmount).toBe(200);
 });
 it('rejects technician access to profit',async()=>{
  expect((await request('orders','GET',`/${id}/profitability`,undefined,'TECNICO')).statusCode).toBe(403);
  expect(db.serviceOrder.findFirst).not.toHaveBeenCalled();
 });
 it('rejects inconsistent customer and unit before creating an OS',async()=>{
  db.customerUnit.findFirst.mockResolvedValue(null);
  expect((await request('orders','POST','/',{customerId:id,unitId:other,reportedProblem:'Não refrigera'})).statusCode).toBe(422);
  expect(db.serviceOrder.create).not.toHaveBeenCalled();
 });
 it('rejects an equipment from a different location',async()=>{
  db.customerUnit.findFirst.mockResolvedValue({id});db.equipment.findFirst.mockResolvedValue(null);
  expect((await request('orders','POST','/',{customerId:id,unitId:id,equipmentId:other,reportedProblem:'Não refrigera'})).statusCode).toBe(422);
  expect(db.equipment.findFirst).toHaveBeenCalledWith({where:{id:other,companyId:company,customerId:id,unitId:id}});
  expect(db.serviceOrder.create).not.toHaveBeenCalled();
 });
 it('rejects inactive or foreign assignees',async()=>{
  db.customerUnit.findFirst.mockResolvedValue({id});db.user.count.mockResolvedValue(0);
  expect((await request('orders','POST','/',{customerId:id,unitId:id,technicianIds:[other],reportedProblem:'Não refrigera'})).statusCode).toBe(422);
  expect(db.serviceOrder.create).not.toHaveBeenCalled();
 });
 it('creates an OS for a valid customer unit',async()=>{
  db.customerUnit.findFirst.mockResolvedValue({id});db.serviceOrder.create.mockImplementation(async x=>x.data);
  const r=await request('orders','POST','/',{customerId:id,unitId:id,reportedProblem:'Não refrigera'});
  expect(r.statusCode).toBe(201);expect(r.json().companyId).toBe(company);expect(r.json().orderNumber).toBe('OS-000001');
 });
});
describe('Units required by the quote form',()=>{
 it('lists units of an owned customer',async()=>{
  db.customer.findFirst.mockResolvedValue({id});db.customerUnit.findMany.mockResolvedValue([{id,name:'Matriz'}]);
  const r=await request('units','GET',`/customer/${id}`);
  expect(r.statusCode).toBe(200);expect(r.json()[0].name).toBe('Matriz');
  expect(db.customer.findFirst).toHaveBeenCalledWith({where:{id,companyId:company,active:true}});
 });
 it('does not list units of a foreign customer',async()=>{
  db.customer.findFirst.mockResolvedValue(null);
  expect((await request('units','GET',`/customer/${other}`)).statusCode).toBe(404);
  expect(db.customerUnit.findMany).not.toHaveBeenCalled();
 });
});
describe('Quote conversion: relations and duplicate conversion',()=>{
 beforeEach(()=>db.quote.findFirst.mockResolvedValue({id,companyId:company,customerId:id,unitId:id,status:'APPROVED',convertedAt:null,total:500,items:[]}));
 it('rejects an environment outside the quote unit',async()=>{
  db.environment.findFirst.mockResolvedValue(null);
  expect((await request('quotes','POST',`/${id}/convert-to-service-order`,{environmentId:other})).statusCode).toBe(422);
  expect(db.quote.updateMany).not.toHaveBeenCalled();expect(db.serviceOrder.create).not.toHaveBeenCalled();
 });
 it('rejects equipment outside the customer and unit',async()=>{
  db.equipment.findFirst.mockResolvedValue(null);
  expect((await request('quotes','POST',`/${id}/convert-to-service-order`,{equipmentId:other})).statusCode).toBe(422);
  expect(db.serviceOrder.create).not.toHaveBeenCalled();
 });
 it('does not create a second OS if another conversion already claimed the quote',async()=>{
  db.quote.updateMany.mockResolvedValue({count:0});
  expect((await request('quotes','POST',`/${id}/convert-to-service-order`,{})).statusCode).toBe(409);
  expect(db.serviceOrder.create).not.toHaveBeenCalled();
 });
 it('claims the quote before creating its OS',async()=>{
  db.quote.updateMany.mockResolvedValue({count:1});db.serviceOrder.create.mockImplementation(async x=>x.data);
  const r=await request('quotes','POST',`/${id}/convert-to-service-order`,{});
  expect(r.statusCode).toBe(201);expect(r.json().quoteId).toBe(id);
  expect(db.quote.updateMany).toHaveBeenCalledWith({where:{id,companyId:company,status:'APPROVED',convertedAt:null},data:{convertedAt:expect.any(Date)}});
  expect(db.quote.updateMany.mock.invocationCallOrder[0]).toBeLessThan(db.serviceOrder.create.mock.invocationCallOrder[0]);
 });
});

 describe('Unit editing: optional state',()=>{
  it.each(['','  '])('clears blank state %j without rejecting the unit',async state=>{
   db.customerUnit.findFirst.mockResolvedValue({id});db.customerUnit.update.mockImplementation(async x=>x.data);
   const r=await request('units','PATCH',`/${id}`,{name:'Unidade Teste',state});
   expect(r.statusCode).toBe(200);expect(r.json().state).toBeNull();
  });
  it('rejects a malformed state before writing',async()=>{
   expect((await request('units','PATCH',`/${id}`,{state:'PARAIBA'})).statusCode).toBe(422);
   expect(db.customerUnit.update).not.toHaveBeenCalled();
  });
 });
