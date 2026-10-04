import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import type {FastifyInstance} from 'fastify';
import {beforeAll,afterAll,describe,expect,it} from 'vitest';

// Requires an explicitly selected disposable local database. Never use production.
const database=process.env.TEST_DATABASE_URL;
if(database){
 const url=new URL(database);
 if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.includes('solucenter_test'))throw new Error('Integration tests require a disposable local solucenter_test database');
 process.env.DATABASE_URL=database;
}
describe.skipIf(!database)('PostgreSQL: operational cycle and tenant isolation',()=>{
 let app:FastifyInstance;
 let db:typeof import('../src/lib/prisma.js').prisma;
 let token:string,foreignToken:string,companyId:string,userId:string,foreignCompanyId:string;
 const email=`test-${randomUUID()}@example.com`,password='Isolated-Test-Only-2026!';
 async function call(method:'GET'|'POST',path:string,payload?:object,access=token){
  return app.inject({method,url:'/api/v1'+path,payload,headers:access?{authorization:`Bearer ${access}`}:{}});
 }
 beforeAll(async()=>{
  await mkdir('uploads',{recursive:true});
  db=(await import('../src/lib/prisma.js')).prisma;
  const company=await db.company.create({data:{tradeName:'Integration Test'}});
  const role=await db.role.create({data:{companyId:company.id,name:'ADMIN'}});
  const user=await db.user.create({data:{companyId:company.id,roleId:role.id,name:'Test Admin',email,passwordHash:await bcrypt.hash(password,4)}});
  companyId=company.id;userId=user.id;
  app=(await import('../src/server.js')).buildApp();await app.ready();
  const other=await db.company.create({data:{tradeName:'Foreign Test Company'}});
  foreignCompanyId=other.id;
  foreignToken=app.jwt.sign({id:randomUUID(),companyId:other.id,role:'ADMIN',permissions:[]});
  token=app.jwt.sign({id:user.id,companyId:company.id,role:'ADMIN',permissions:[]});
 },30000);
 async function fixture(){
  const customer=await db.customer.create({data:{companyId,code:randomUUID(),name:'Financial Test',type:'PJ'}});
  const unit=await db.customerUnit.create({data:{customerId:customer.id,name:'Matriz'}});
  const os=await db.serviceOrder.create({data:{companyId,customerId:customer.id,unitId:unit.id,createdById:userId,orderNumber:randomUUID(),reportedProblem:'Financial test',status:'COMPLETED',finalValue:100}});
  return {customer,unit,os};
 }
 it('commits only one concurrent full payment',async()=>{
  const {customer}=await fixture();
  const r=await db.accountReceivable.create({data:{companyId,customerId:customer.id,description:'Race test',originalAmount:100,openAmount:100,dueDate:new Date()}});
  const responses=await Promise.all([call('POST',`/finance/receivables/${r.id}/payments`,{amount:100,paymentMethod:'PIX'}),call('POST',`/finance/receivables/${r.id}/payments`,{amount:100,paymentMethod:'PIX'})]);
  expect(responses.map(x=>x.statusCode).sort()).toEqual([200,409]);
  expect(await db.payment.count({where:{receivableId:r.id}})).toBe(1);
  const saved=await db.accountReceivable.findUniqueOrThrow({where:{id:r.id}});
  expect(Number(saved.openAmount)).toBe(0);expect(saved.status).toBe('PAID');
 });
 it('preserves the balance under concurrent partial payments',async()=>{
  const {customer}=await fixture();
  const r=await db.accountReceivable.create({data:{companyId,customerId:customer.id,description:'Partial race',originalAmount:100,openAmount:100,dueDate:new Date()}});
  const responses=await Promise.all([call('POST',`/finance/receivables/${r.id}/payments`,{amount:30,paymentMethod:'PIX'}),call('POST',`/finance/receivables/${r.id}/payments`,{amount:30,paymentMethod:'PIX'})]);
  expect(responses.every(x=>[200,409].includes(x.statusCode))).toBe(true);
  const successful=responses.filter(x=>x.statusCode===200).length;expect(successful).toBeGreaterThan(0);
  const paid=await db.payment.aggregate({where:{receivableId:r.id},_sum:{amount:true}});
  const saved=await db.accountReceivable.findUniqueOrThrow({where:{id:r.id}});
  expect(Number(paid._sum.amount)).toBe(successful*30);expect(Number(saved.openAmount)+Number(paid._sum.amount)).toBe(100);
 });
 it('creates only one invoice when both invoice endpoints race',async()=>{
  const {customer,os}=await fixture();
  const responses=await Promise.all([call('POST',`/service-orders/${os.id}/invoice`,{dueDate:'2026-10-15'}),call('POST','/finance/receivables',{customerId:customer.id,serviceOrderId:os.id,description:'Manual invoice',amount:100,dueDate:'2026-10-15'})]);
  expect(responses.filter(x=>[200,201].includes(x.statusCode))).toHaveLength(1);
  expect(responses.filter(x=>x.statusCode===409)).toHaveLength(1);
  expect(await db.accountReceivable.count({where:{serviceOrderId:os.id}})).toBe(1);
  expect((await db.serviceOrder.findUniqueOrThrow({where:{id:os.id}})).status).toBe('INVOICED');
 });
 it('rejects a foreign customer or another customer’s OS without saving a receivable',async()=>{
  const {customer,os}=await fixture();
  const foreign=await db.customer.create({data:{companyId:foreignCompanyId,code:randomUUID(),name:'Foreign',type:'PJ'}});
  const other=await db.customer.create({data:{companyId,code:randomUUID(),name:'Other Customer',type:'PJ'}});
  expect((await call('POST','/finance/receivables',{customerId:foreign.id,description:'Invalid',amount:100,dueDate:'2026-10-15'})).statusCode).toBe(404);
  expect((await call('POST','/finance/receivables',{customerId:other.id,serviceOrderId:os.id,description:'Invalid',amount:100,dueDate:'2026-10-15'})).statusCode).toBe(422);
  expect(await db.accountReceivable.count({where:{OR:[{customerId:foreign.id},{customerId:other.id},{serviceOrderId:os.id}]}})).toBe(0);
  expect((await db.serviceOrder.findUniqueOrThrow({where:{id:os.id}})).status).toBe('COMPLETED');
  expect(customer.companyId).toBe(companyId);
 });
 it('blocks foreign payments and technician invoicing',async()=>{
  const {customer,os}=await fixture();
  const r=await db.accountReceivable.create({data:{companyId,customerId:customer.id,description:'Permissions',originalAmount:100,openAmount:100,dueDate:new Date()}});
  expect((await call('POST',`/finance/receivables/${r.id}/payments`,{amount:100,paymentMethod:'PIX'},foreignToken)).statusCode).toBe(404);
  const technician=app.jwt.sign({id:userId,companyId,role:'TECNICO',permissions:[]});
  expect((await call('POST',`/service-orders/${os.id}/invoice`,{dueDate:'2026-10-15'},technician)).statusCode).toBe(403);
  expect(await db.payment.count({where:{receivableId:r.id}})).toBe(0);
 });
 it('rejects fractions of a cent and records an exact cent payment',async()=>{
  const {customer}=await fixture();
  expect((await call('POST','/finance/receivables',{customerId:customer.id,description:'Invalid cents',amount:0.001,dueDate:'2026-10-15'})).statusCode).toBe(422);
  const r=await db.accountReceivable.create({data:{companyId,customerId:customer.id,description:'Cent test',originalAmount:0.03,openAmount:0.03,dueDate:new Date()}});
  expect((await call('POST',`/finance/receivables/${r.id}/payments`,{amount:0.001,paymentMethod:'PIX'})).statusCode).toBe(422);
  expect((await call('POST',`/finance/receivables/${r.id}/payments`,{amount:0.01,paymentMethod:'PIX'})).statusCode).toBe(200);
  expect(Number((await db.accountReceivable.findUniqueOrThrow({where:{id:r.id}})).openAmount)).toBe(0.02);
  expect(Number((await db.payment.findFirstOrThrow({where:{receivableId:r.id}})).amount)).toBe(0.01);
 });
 afterAll(async()=>{await app?.close();await db?.$disconnect()});
 it('logs in, registers hierarchy/equipment, converts a quote, executes and receives an OS',async()=>{
  const login=await call('POST','/auth/login',{email,password},'');expect(login.statusCode).toBe(200);token=login.json().accessToken;
  const customerResponse=await call('POST','/customers/',{type:'PJ',name:'Test Customer'});expect(customerResponse.statusCode).toBe(201);const customer=customerResponse.json();
  const unitResponse=await call('POST',`/customers/${customer.id}/units`,{name:'Matriz',state:'PB'});expect(unitResponse.statusCode).toBe(201);const unit=unitResponse.json();
  const units=await call('GET',`/units/customer/${customer.id}`);expect(units.statusCode).toBe(200);expect(units.json()[0].id).toBe(unit.id);
  const envResponse=await call('POST',`/units/${unit.id}/environments`,{name:'Sala'});expect(envResponse.statusCode).toBe(201);const env=envResponse.json();
  const equipmentResponse=await call('POST','/equipment/',{customerId:customer.id,unitId:unit.id,environmentId:env.id,equipmentType:'SPLIT',capacityBtu:12000});expect(equipmentResponse.statusCode).toBe(201);const equipment=equipmentResponse.json();
  const quoteResponse=await call('POST','/quotes/',{customerId:customer.id,unitId:unit.id,items:[{itemType:'SERVICE',description:'Manutenção',quantity:1,unitPrice:500,unitCost:100}]});expect(quoteResponse.statusCode).toBe(201);const quote=quoteResponse.json();
  expect((await call('POST',`/quotes/${quote.id}/send`,{})).statusCode).toBe(200);
  expect((await call('POST',`/quotes/${quote.id}/approve`,{})).statusCode).toBe(200);
  // Both conversions race against the same PostgreSQL row, not a mocked database.
  const conversions=await Promise.all([call('POST',`/quotes/${quote.id}/convert-to-service-order`,{equipmentId:equipment.id,environmentId:env.id}),call('POST',`/quotes/${quote.id}/convert-to-service-order`,{equipmentId:equipment.id,environmentId:env.id})]);
  expect(conversions.map(r=>r.statusCode).sort()).toEqual([201,409]);const os=conversions.find(r=>r.statusCode===201)!.json();
  expect(await db.serviceOrder.count({where:{quoteId:quote.id}})).toBe(1);
  expect((await call('POST',`/service-orders/${os.id}/measurements`,{voltage:220},foreignToken)).statusCode).toBe(404);
  expect((await call('POST',`/service-orders/${os.id}/start`,{})).statusCode).toBe(200);
  const measured=await call('POST',`/service-orders/${os.id}/measurements`,{returnTemperature:26,supplyTemperature:14});expect(measured.statusCode).toBe(201);expect(Number(measured.json().deltaT)).toBe(12);
  expect((await call('POST',`/service-orders/${os.id}/complete`,{technicalDiagnosis:'Filtro sujo',performedService:'Limpeza completa',finalValue:500,laborCost:100})).statusCode).toBe(200);
  const invoiceResponse=await call('POST',`/service-orders/${os.id}/invoice`,{dueDate:'2026-10-15'});expect(invoiceResponse.statusCode).toBe(200);const invoice=invoiceResponse.json();
  expect((await call('POST',`/finance/receivables/${invoice.id}/payments`,{amount:501,paymentMethod:'PIX'})).statusCode).toBe(409);
  const payment=await call('POST',`/finance/receivables/${invoice.id}/payments`,{amount:500,paymentMethod:'PIX'});expect(payment.statusCode).toBe(200);expect(payment.json().receivable.status).toBe('PAID');
  expect((await db.serviceOrder.findUniqueOrThrow({where:{id:os.id}})).status).toBe('RECEIVED');
  expect((await call('GET',`/customers/${customer.id}`,undefined,foreignToken)).statusCode).toBe(404);
 },30000);
});
