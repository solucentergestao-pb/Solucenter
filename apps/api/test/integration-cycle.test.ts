import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
 let token:string,foreignToken:string,companyId:string,userId:string,foreignCompanyId:string,privateRoot:string;
 const email=`test-${randomUUID()}@example.com`,password='Isolated-Test-Only-2026!';
 async function call(method:'GET'|'POST'|'PUT',path:string,payload?:object,access=token){
  return app.inject({method,url:'/api/v1'+path,payload,headers:access?{authorization:`Bearer ${access}`}:{}});
 }
 beforeAll(async()=>{
  privateRoot=await mkdtemp(join(tmpdir(),'solucenter-private-'));process.env.PRIVATE_UPLOAD_ROOT=privateRoot;
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
 async function upload(path:string,bytes:Buffer,access=token,mimetype='image/png'){
  const boundary=`solucenter-${randomUUID()}`;
  const head=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nBEFORE\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: ${mimetype}\r\n\r\n`);
  const tail=Buffer.from(`\r\n--${boundary}--\r\n`);
  return app.inject({method:'POST',url:`/api/v1${path}`,payload:Buffer.concat([head,bytes,tail]),headers:{authorization:`Bearer ${access}`,'content-type':`multipart/form-data; boundary=${boundary}`}});
 }
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
 it('stores photos privately and requires an authorized tenant to read them',async()=>{
  const {customer,unit,os}=await fixture();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  const equipment=await db.equipment.create({data:{companyId,customerId:customer.id,unitId:unit.id,assetCode:randomUUID(),equipmentType:'SPLIT'}});
  const equipmentSaved=await upload(`/uploads/equipment/${equipment.id}/photo`,png);
  expect(equipmentSaved.statusCode).toBe(201);expect(equipmentSaved.json().fileUrl).toBeUndefined();
  expect((await call('GET',equipmentSaved.json().downloadUrl.replace('/api/v1',''))).statusCode).toBe(200);
  expect((await call('GET',equipmentSaved.json().downloadUrl.replace('/api/v1',''),undefined,foreignToken)).statusCode).toBe(404);
  const saved=await upload(`/uploads/service-orders/${os.id}/photo`,png);
  expect(saved.statusCode).toBe(201);expect(saved.json().fileUrl).toBeUndefined();
  expect(saved.json().downloadUrl).toMatch(/^\/api\/v1\/uploads\/service-order-photos\//);
  const photo=await db.servicePhoto.findUniqueOrThrow({where:{id:saved.json().id}});
  expect(photo.fileUrl).toMatch(new RegExp(`^private://${companyId}/service-orders/`));
  const own=await call('GET',`/uploads/service-order-photos/${photo.id}`);expect(own.statusCode).toBe(200);expect(own.headers['content-type']).toContain('image/png');
  expect((await call('GET',`/uploads/service-order-photos/${photo.id}`,undefined,foreignToken)).statusCode).toBe(404);
  const portalToken=app.jwt.sign({portalUserId:randomUUID(),companyId,customerId:customer.id,kind:'customer'});
  expect((await call('GET',`/uploads/service-order-photos/${photo.id}`,undefined,portalToken)).statusCode).toBe(200);
  const otherCustomer=await db.customer.create({data:{companyId,code:randomUUID(),name:'Other Portal Customer',type:'PJ'}});
  const otherPortalToken=app.jwt.sign({portalUserId:randomUUID(),companyId,customerId:otherCustomer.id,kind:'customer'});
  expect((await call('GET',`/uploads/service-order-photos/${photo.id}`,undefined,otherPortalToken)).statusCode).toBe(404);
  expect((await app.inject({method:'GET',url:`/api/v1/uploads/service-order-photos/${photo.id}`})).statusCode).toBe(401);
  expect((await upload(`/uploads/service-orders/${os.id}/photo`,Buffer.from('not an image'))).statusCode).toBe(422);
  expect((await call('POST',`/service-orders/${os.id}/photos`,{category:'BEFORE',fileUrl:'https://attacker.invalid/photo.jpg'})).statusCode).toBe(404);
  expect(await db.servicePhoto.count({where:{serviceOrderId:os.id}})).toBe(1);
 });
 it('generates private PDFs with expiring public links and tenant guards',async()=>{
  const {customer,unit,os}=await fixture();
  const quote=await db.quote.create({data:{companyId,customerId:customer.id,unitId:unit.id,createdById:userId,quoteNumber:randomUUID(),subtotal:500,total:500,estimatedCost:100,estimatedProfit:400,items:{create:{itemType:'SERVICE',description:'Manutenção completa',quantity:1,unitPrice:500,unitCost:100}}}});
  const generated=await call('POST',`/documents/quotes/${quote.id}/pdf`);
  expect(generated.statusCode).toBe(200);expect(generated.json().document.fileUrl).toBeUndefined();expect(generated.json().document.expiresAt).toBeTruthy();
  const quoteDocument=await db.generatedDocument.findUniqueOrThrow({where:{id:generated.json().document.id}});
  expect(quoteDocument.fileUrl).toMatch(new RegExp(`^private://${companyId}/documents/`));
  const publicPdf=await app.inject({method:'GET',url:new URL(generated.json().shareUrl).pathname});
  expect(publicPdf.statusCode).toBe(200);expect(publicPdf.headers['content-type']).toContain('application/pdf');expect(publicPdf.rawPayload.subarray(0,4).toString()).toBe('%PDF');
  expect((await call('POST',`/documents/quotes/${quote.id}/pdf`,undefined,foreignToken)).statusCode).toBe(404);
  const technician=app.jwt.sign({id:userId,companyId,role:'TECNICO',permissions:[]});
  expect((await call('POST',`/documents/quotes/${quote.id}/pdf`,undefined,technician)).statusCode).toBe(403);
  const report=await call('POST',`/documents/service-orders/${os.id}/pdf`);expect(report.statusCode).toBe(200);
  expect((await app.inject({method:'GET',url:new URL(report.json().shareUrl).pathname})).statusCode).toBe(200);
  await db.generatedDocument.update({where:{id:quoteDocument.id},data:{expiresAt:new Date(Date.now()-1000)}});
  expect((await app.inject({method:'GET',url:new URL(generated.json().shareUrl).pathname})).statusCode).toBe(404);
  expect((await app.inject({method:'GET',url:'/public/documents/not-a-token'})).statusCode).toBe(404);
 });
 it('isolates dashboard totals and blocks roles without dashboard permission',async()=>{
  const company=await db.company.create({data:{tradeName:'Dashboard Isolated'}});
  const role=await db.role.create({data:{companyId:company.id,name:'ADMIN'}});
  const user=await db.user.create({data:{companyId:company.id,roleId:role.id,name:'Dashboard Admin',email:`dash-${randomUUID()}@example.com`,passwordHash:'unused'}});
  const customer=await db.customer.create({data:{companyId:company.id,code:randomUUID(),name:'Dashboard Customer',type:'PJ'}});
  const unit=await db.customerUnit.create({data:{customerId:customer.id,name:'Matriz'}});
  const os=await db.serviceOrder.create({data:{companyId:company.id,customerId:customer.id,unitId:unit.id,createdById:user.id,orderNumber:randomUUID(),reportedProblem:'Dashboard',status:'COMPLETED',completedAt:new Date(),finalValue:250,laborCost:100}});
  const receivable=await db.accountReceivable.create({data:{companyId:company.id,customerId:customer.id,serviceOrderId:os.id,description:'Dashboard',originalAmount:250,openAmount:0,dueDate:new Date(),status:'PAID'}});
  await db.payment.create({data:{receivableId:receivable.id,amount:250,paymentMethod:'PIX'}});
  const dashboardToken=app.jwt.sign({id:user.id,companyId:company.id,role:'ADMIN',permissions:[]});
  const dashboard=await call('GET','/dashboard',undefined,dashboardToken);expect(dashboard.statusCode).toBe(200);
  expect(dashboard.json()).toMatchObject({revenue:250,costs:100,profit:150,completedOrders:1});
  const monthly=await call('GET','/dashboard/monthly?months=3',undefined,dashboardToken);expect(monthly.statusCode).toBe(200);
  expect(monthly.json().months.at(-1)).toMatchObject({actualRevenue:250,actualCost:100,actualProfit:150});
  const technician=app.jwt.sign({id:user.id,companyId:company.id,role:'TECNICO',permissions:[]});
  expect((await call('GET','/dashboard',undefined,technician)).statusCode).toBe(403);
 });
 it('guards expense relations, cents, payable races and scoped cash reports',async()=>{
  const company=await db.company.create({data:{tradeName:'Isolated cash test'}});
  const access=app.jwt.sign({id:userId,companyId:company.id,role:'ADMIN',permissions:[]});
  const category=await db.expenseCategory.create({data:{companyId:company.id,name:'Office',dreGroup:'ADMIN'}});
  const foreignCategory=await db.expenseCategory.create({data:{companyId:foreignCompanyId,name:randomUUID(),dreGroup:'ADMIN'}});
  const inactive=await db.expenseCategory.create({data:{companyId:company.id,name:'Inactive',dreGroup:'ADMIN',active:false}});
  const {os}=await fixture();
  const expense={categoryId:category.id,description:'Office cost',amount:20.25,competenceDate:'2026-10-07'};
  for(const categoryId of [foreignCategory.id,inactive.id,randomUUID()])expect((await call('POST','/management-finance/expenses',{...expense,categoryId},access)).statusCode).toBe(422);
  expect((await call('POST','/management-finance/expenses',{...expense,serviceOrderId:os.id},access)).statusCode).toBe(422);
  expect((await call('POST','/management-finance/expenses',{...expense,amount:1.001},access)).statusCode).toBe(422);
  expect(await db.expense.count({where:{companyId:company.id}})).toBe(0);
  expect((await call('POST','/management-finance/expenses',expense,access)).statusCode).toBe(201);
  expect((await call('POST','/management-finance/expenses',{...expense,status:'OPEN',amount:99},access)).statusCode).toBe(201);
  const payable={description:'Supplier',amount:30.75,dueDate:'2026-10-07'};
  expect((await call('POST','/management-finance/payables',{...payable,amount:1.001},access)).statusCode).toBe(422);
  const created=await call('POST','/management-finance/payables',payable,access);expect(created.statusCode).toBe(201);const id=created.json().id;
  expect((await call('POST',`/management-finance/payables/${id}/pay`,{paymentMethod:'PIX'},foreignToken)).statusCode).toBe(409);
  expect((await db.accountPayable.findUniqueOrThrow({where:{id}})).status).toBe('OPEN');
  const payments=await Promise.all([call('POST',`/management-finance/payables/${id}/pay`,{paymentMethod:'PIX',paidDate:'2026-10-07'},access),call('POST',`/management-finance/payables/${id}/pay`,{paymentMethod:'CASH',paidDate:'2026-10-08'},access)]);
  expect(payments.map(r=>r.statusCode).sort()).toEqual([200,409]);
  await db.accountPayable.create({data:{companyId:foreignCompanyId,...payable,dueDate:new Date(payable.dueDate),status:'PAID',paidDate:new Date('2026-10-07')}});
  const period='?from=2026-01-01&to=2027-01-01';
  const cash=await call('GET','/management-finance/cash-flow'+period,undefined,access);expect(cash.statusCode).toBe(200);
  expect(cash.json().inflows).toEqual([]);expect(cash.json().outflows).toHaveLength(2);
  expect(cash.json().outflows.map((x:any)=>x.amount).sort((a:number,b:number)=>a-b)).toEqual([20.25,30.75]);
  const dre=await call('GET','/management-finance/dre'+period,undefined,access);expect(dre.statusCode).toBe(200);expect(dre.json()).toMatchObject({revenue:0,operatingExpenses:20.25,operatingResult:-20.25});
  for(const route of ['cash-flow','dre']){
   expect((await call('GET',`/management-finance/${route}?from=invalid&to=2026-10-07`,undefined,access)).statusCode).toBe(422);
   expect((await call('GET',`/management-finance/${route}?from=2026-10-08&to=2026-10-07`,undefined,access)).statusCode).toBe(422);
   const technician=app.jwt.sign({id:userId,companyId:company.id,role:'TECNICO',permissions:[]});
   expect((await call('GET',`/management-finance/${route}`+period,undefined,technician)).statusCode).toBe(403);
  }
 });
 it('protects agenda and preventive plans across tenants and concurrent requests',async()=>{
  const technicianRole=await db.role.create({data:{companyId,name:'TECNICO'}});
  const technician=await db.user.create({data:{companyId,roleId:technicianRole.id,name:'Agenda Technician',email:`agenda-${randomUUID()}@example.com`,passwordHash:'unused'}});
  const foreignRole=await db.role.create({data:{companyId:foreignCompanyId,name:'TECNICO'}});
  const foreignTechnician=await db.user.create({data:{companyId:foreignCompanyId,roleId:foreignRole.id,name:'Foreign Technician',email:`foreign-agenda-${randomUUID()}@example.com`,passwordHash:'unused'}});
  const customer=await db.customer.create({data:{companyId,code:randomUUID(),name:'Preventive Customer',type:'PJ'}});
  const unit=await db.customerUnit.create({data:{customerId:customer.id,name:'Preventive Unit'}});
  const equipment=await db.equipment.create({data:{companyId,customerId:customer.id,unitId:unit.id,assetCode:randomUUID(),equipmentType:'SPLIT'}});
  const order=await db.serviceOrder.create({data:{companyId,customerId:customer.id,unitId:unit.id,equipmentId:equipment.id,createdById:userId,orderNumber:randomUUID(),reportedProblem:'Preventive test'}});
  const foreignCustomer=await db.customer.create({data:{companyId:foreignCompanyId,code:randomUUID(),name:'Foreign Preventive Customer',type:'PJ'}});
  const foreignUnit=await db.customerUnit.create({data:{customerId:foreignCustomer.id,name:'Foreign Unit'}});
  const foreignEquipment=await db.equipment.create({data:{companyId:foreignCompanyId,customerId:foreignCustomer.id,unitId:foreignUnit.id,assetCode:randomUUID(),equipmentType:'SPLIT'}});
  const foreignOrder=await db.serviceOrder.create({data:{companyId:foreignCompanyId,customerId:foreignCustomer.id,unitId:foreignUnit.id,equipmentId:foreignEquipment.id,createdById:foreignTechnician.id,orderNumber:randomUUID(),reportedProblem:'Foreign preventive test'}});
  const startsAt=new Date(Date.now()+2*86400000),endsAt=new Date(startsAt.getTime()+3600000);
  const schedule={technicianId:technician.id,serviceOrderId:order.id,title:'Preventive visit',startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()};
  expect((await call('POST','/operations/schedule',{...schedule,technicianId:foreignTechnician.id})).statusCode).toBe(422);
  expect((await call('POST','/operations/schedule',{...schedule,serviceOrderId:foreignOrder.id})).statusCode).toBe(422);
  expect((await call('POST','/operations/schedule',{...schedule,endsAt:startsAt.toISOString()})).statusCode).toBe(422);
  const scheduled=await Promise.all([call('POST','/operations/schedule',schedule),call('POST','/operations/schedule',schedule)]);
  expect(scheduled.map(x=>x.statusCode).sort()).toEqual([201,409]);
  expect(await db.technicianSchedule.count({where:{companyId,technicianId:technician.id}})).toBe(1);
  expect((await call('GET','/operations/schedule',undefined,foreignToken)).json()).toEqual([]);
  const technicianToken=app.jwt.sign({id:technician.id,companyId,role:'TECNICO',permissions:[]});
  expect((await call('GET','/operations/schedule',undefined,technicianToken)).statusCode).toBe(200);
  expect((await call('POST','/operations/schedule',schedule,technicianToken)).statusCode).toBe(403);
  const startDate=new Date(Date.now()+5*86400000).toISOString();
  const plan={customerId:customer.id,name:'Quarterly HVAC',frequency:'QUARTERLY',startDate,equipmentIds:[equipment.id]};
  expect((await call('POST','/operations/maintenance-plans',{...plan,customerId:foreignCustomer.id})).statusCode).toBe(422);
  expect((await call('POST','/operations/maintenance-plans',{...plan,equipmentIds:[foreignEquipment.id]})).statusCode).toBe(422);
  expect((await call('POST','/operations/maintenance-plans',{...plan,equipmentIds:[equipment.id,equipment.id]})).statusCode).toBe(422);
  expect((await call('POST','/operations/maintenance-plans',{...plan,frequency:'CUSTOM'})).statusCode).toBe(422);
  const created=await call('POST','/operations/maintenance-plans',plan);expect(created.statusCode).toBe(201);
  expect(created.json().occurrences).toHaveLength(2);
  const due=await call('GET','/operations/maintenance-due');expect(due.statusCode).toBe(200);
  expect(due.json().some((x:any)=>x.plan.id===created.json().id)).toBe(true);
  expect((await call('GET','/operations/maintenance-plans',undefined,foreignToken)).json()).toEqual([]);
  expect((await call('GET','/operations/maintenance-due',undefined,foreignToken)).json()).toEqual([]);
  expect((await call('GET','/operations/maintenance-due',undefined,technicianToken)).statusCode).toBe(200);
  expect((await call('POST','/operations/maintenance-plans',plan,technicianToken)).statusCode).toBe(403);
 });
 it('isolates portal accounts, requests and concurrent quote decisions',async()=>{
  const portalEmail=`portal-${randomUUID()}@example.com`,portalPassword='Portal-Test-Only-2026!',foreignPassword='Foreign-Portal-2026!';
  const customer=await db.customer.create({data:{companyId,code:randomUUID(),name:'Portal Customer',type:'PJ'}});
  const unit=await db.customerUnit.create({data:{customerId:customer.id,name:'Portal Unit'}});
  const equipment=await db.equipment.create({data:{companyId,customerId:customer.id,unitId:unit.id,assetCode:randomUUID(),equipmentType:'SPLIT'}});
  const foreignCustomer=await db.customer.create({data:{companyId:foreignCompanyId,code:randomUUID(),name:'Foreign Portal Customer',type:'PJ'}});
  const foreignUnit=await db.customerUnit.create({data:{customerId:foreignCustomer.id,name:'Foreign Unit'}});
  const foreignEquipment=await db.equipment.create({data:{companyId:foreignCompanyId,customerId:foreignCustomer.id,unitId:foreignUnit.id,assetCode:randomUUID(),equipmentType:'SPLIT'}});
  const portalHash=await bcrypt.hash(portalPassword,4);
  const portalUser=await db.customerPortalUser.create({data:{companyId,customerId:customer.id,name:'Portal User',email:portalEmail,passwordHash:portalHash}});
  const foreignPortal=await db.customerPortalUser.create({data:{companyId:foreignCompanyId,customerId:foreignCustomer.id,name:'Foreign Portal User',email:portalEmail,passwordHash:await bcrypt.hash(foreignPassword,4)}});
  const login=await call('POST','/portal/auth/login',{email:portalEmail,password:portalPassword},'');
  expect(login.statusCode).toBe(200);const portalToken=login.json().accessToken;
  expect((await call('GET','/portal/me',undefined,token)).statusCode).toBe(403);
  expect((await call('POST','/portal/auth/login',{email:portalEmail,password:'Wrong-Password-2026!'},'')).statusCode).toBe(401);
  const invalidRequest=await call('POST','/portal/requests',{unitId:unit.id,equipmentId:foreignEquipment.id,subject:'Falha no ar',description:'Equipamento sem refrigeração'},portalToken);
  expect(invalidRequest.statusCode).toBe(403);
  const validRequest=await call('POST','/portal/requests',{unitId:unit.id,equipmentId:equipment.id,subject:'Falha no ar',description:'Equipamento sem refrigeração'},portalToken);
  expect(validRequest.statusCode).toBe(201);
  const quote=await db.quote.create({data:{companyId,customerId:customer.id,unitId:unit.id,createdById:userId,quoteNumber:randomUUID(),status:'SENT',subtotal:100,total:100}});
  const decisions=await Promise.all([
   call('POST',`/portal/quotes/${quote.id}/decision`,{decision:'APPROVE'},portalToken),
   call('POST',`/portal/quotes/${quote.id}/decision`,{decision:'DECLINE'},portalToken)
  ]);
  expect(decisions.map(x=>x.statusCode).sort()).toEqual([200,409]);
  expect(await db.customerQuoteDecision.count({where:{quoteId:quote.id}})).toBe(1);
  await db.customerPortalUser.update({where:{id:foreignPortal.id},data:{passwordHash:portalHash}});
  expect((await call('POST','/portal/auth/login',{email:portalEmail,password:portalPassword},'')).statusCode).toBe(409);
  expect(portalUser.companyId).toBe(companyId);
 },30000);
 it('scopes notification processing and atomically claims queue items',async()=>{
  const own=await db.notification.create({data:{companyId,eventType:'PAYMENT_RECEIVED',channel:'IN_APP',recipient:'portal-user',body:'Pagamento recebido'}});
  const foreign=await db.notification.create({data:{companyId:foreignCompanyId,eventType:'PAYMENT_RECEIVED',channel:'IN_APP',recipient:'foreign-user',body:'Pagamento recebido'}});
  const gestor=app.jwt.sign({id:randomUUID(),companyId,role:'GESTOR',permissions:[]});
  expect((await call('GET','/notifications/',undefined,gestor)).statusCode).toBe(200);
  expect((await call('PUT','/notifications/templates/PAYMENT_RECEIVED/IN_APP',{name:'Teste',body:'Teste'},gestor)).statusCode).toBe(403);
  expect((await call('POST','/notifications/process',{},gestor)).statusCode).toBe(403);
  expect((await call('PUT','/notifications/templates/INVALID/IN_APP',{name:'Teste',body:'Teste'})).statusCode).toBe(422);
  const runs=await Promise.all([call('POST','/notifications/process',{}),call('POST','/notifications/process',{})]);
  expect(runs.every(x=>x.statusCode===200)).toBe(true);
  expect((await db.notification.findUniqueOrThrow({where:{id:own.id}})).status).toBe('SENT');
  expect(await db.notificationDelivery.count({where:{notificationId:own.id}})).toBe(1);
  expect((await db.notification.findUniqueOrThrow({where:{id:foreign.id}})).status).toBe('PENDING');
 },30000);
 it('consumes the last part once across concurrent OS and blocks closed orders',async()=>{
  const first=await fixture(),second=await fixture();
  await db.serviceOrder.updateMany({where:{id:{in:[first.os.id,second.os.id]}},data:{status:'IN_PROGRESS'}});
  const material=await db.material.create({data:{companyId,sku:randomUUID(),description:'Last part',unit:'UN',stockQuantity:1,averageCost:3,salePrice:10}});
  const payload={materialId:material.id,quantity:1};
  const results=await Promise.all([call('POST',`/service-orders/${first.os.id}/materials`,payload),call('POST',`/service-orders/${second.os.id}/materials`,payload)]);
  expect(results.map(x=>x.statusCode).sort()).toEqual([201,409]);
  expect(Number((await db.material.findUniqueOrThrow({where:{id:material.id}})).stockQuantity)).toBe(0);
  expect(await db.serviceOrderMaterial.count({where:{materialId:material.id}})).toBe(1);
  expect(await db.inventoryMovement.count({where:{materialId:material.id}})).toBe(1);
  await db.material.update({where:{id:material.id},data:{stockQuantity:2}});
  for(const status of ['COMPLETED','INVOICED','RECEIVED','CANCELLED'] as const){
   await db.serviceOrder.update({where:{id:first.os.id},data:{status}});
   const response=await call('POST',`/service-orders/${first.os.id}/materials`,payload);
   expect(response.statusCode).toBe(409);expect(response.json().error.code).toBe('SERVICE_ORDER_LOCKED');
  }
  expect(Number((await db.material.findUniqueOrThrow({where:{id:material.id}})).stockQuantity)).toBe(2);
  expect((await call('POST',`/service-orders/${second.os.id}/materials`,{...payload,quantity:0.0001})).statusCode).toBe(422);
  await db.material.update({where:{id:material.id},data:{active:false}});
  expect((await call('POST',`/service-orders/${second.os.id}/materials`,payload)).statusCode).toBe(404);
  await db.material.update({where:{id:material.id},data:{active:true}});
  expect((await call('POST',`/service-orders/${second.os.id}/materials`,payload,foreignToken)).statusCode).toBe(404);
  const foreignMaterial=await db.material.create({data:{companyId:foreignCompanyId,sku:randomUUID(),description:'Foreign part',unit:'UN',stockQuantity:2}});
  expect((await call('POST',`/service-orders/${second.os.id}/materials`,{materialId:foreignMaterial.id,quantity:1})).statusCode).toBe(404);
  expect(Number((await db.material.findUniqueOrThrow({where:{id:foreignMaterial.id}})).stockQuantity)).toBe(2);
  expect(await db.serviceOrderMaterial.count({where:{materialId:material.id}})).toBe(1);
  expect(await db.inventoryMovement.count({where:{materialId:material.id}})).toBe(1);
 },30000);
 it('starts maintenance atomically with stock, reminder, tenant and permission guards',async()=>{
  const customer=await db.customer.create({data:{companyId,code:randomUUID(),name:'Maintenance Customer',type:'PJ'}});
  const unit=await db.customerUnit.create({data:{customerId:customer.id,name:'Maintenance Unit'}});
  const equipment=await db.equipment.create({data:{companyId,customerId:customer.id,unitId:unit.id,assetCode:randomUUID(),equipmentType:'SPLIT'}});
  const foreignCustomer=await db.customer.create({data:{companyId:foreignCompanyId,code:randomUUID(),name:'Foreign Maintenance Customer',type:'PJ'}});
  const foreignUnit=await db.customerUnit.create({data:{customerId:foreignCustomer.id,name:'Foreign Maintenance Unit'}});
  const foreignEquipment=await db.equipment.create({data:{companyId:foreignCompanyId,customerId:foreignCustomer.id,unitId:foreignUnit.id,assetCode:randomUUID(),equipmentType:'SPLIT'}});
  const serviceA=await db.serviceType.create({data:{companyId,name:`Cleaning ${randomUUID()}`,basePrice:100}});
  const serviceB=await db.serviceType.create({data:{companyId,name:`Inspection ${randomUUID()}`,basePrice:200}});
  const inactiveService=await db.serviceType.create({data:{companyId,name:`Inactive ${randomUUID()}`,basePrice:1,active:false}});
  const foreignService=await db.serviceType.create({data:{companyId:foreignCompanyId,name:`Foreign ${randomUUID()}`,basePrice:1}});
  const material=await db.material.create({data:{companyId,sku:randomUUID(),description:'Filter',unit:'UN',averageCost:10,salePrice:50,stockQuantity:3}});
  const foreignMaterial=await db.material.create({data:{companyId:foreignCompanyId,sku:randomUUID(),description:'Foreign filter',unit:'UN',stockQuantity:2}});
  const payload={equipmentId:equipment.id,serviceTypeIds:[serviceA.id,serviceB.id],materials:[{materialId:material.id,quantity:1}],discount:5,surcharge:10,reminderDays:90};
  const before=await db.serviceOrder.count({where:{companyId}});
  for(const invalid of [
   {...payload,equipmentId:foreignEquipment.id},
   {...payload,serviceTypeIds:[serviceA.id,foreignService.id]},
   {...payload,serviceTypeIds:[inactiveService.id]},
   {...payload,materials:[{materialId:foreignMaterial.id,quantity:1}]},
   {...payload,serviceTypeIds:[serviceA.id,serviceA.id]},
   {...payload,materials:[{materialId:material.id,quantity:1},{materialId:material.id,quantity:1}]}
  ])expect((await call('POST','/service-orders/maintenance/start',invalid)).statusCode).toBe(422);
  expect(await db.serviceOrder.count({where:{companyId}})).toBe(before);
  const financeiro=app.jwt.sign({id:randomUUID(),companyId,role:'FINANCEIRO',permissions:[]});
  expect((await call('POST','/service-orders/maintenance/start',payload,financeiro)).statusCode).toBe(403);
  expect((await call('POST','/service-orders/',{customerId:customer.id,unitId:unit.id,equipmentId:equipment.id,reportedProblem:'Unauthorized'},financeiro)).statusCode).toBe(403);
  const created=await call('POST','/service-orders/maintenance/start',payload);expect(created.statusCode).toBe(201);
  const order=created.json().order;
  expect(order.status).toBe('IN_PROGRESS');expect(Number(order.quotedValue)).toBe(355);
  expect(Number((await db.material.findUniqueOrThrow({where:{id:material.id}})).stockQuantity)).toBe(2);
  expect(await db.inventoryMovement.count({where:{serviceOrderId:order.id}})).toBe(1);
  const plan=await db.maintenancePlan.findUniqueOrThrow({where:{id:created.json().reminderPlanId},include:{occurrences:true,equipment:true}});
  expect(plan.occurrences).toHaveLength(2);expect(plan.equipment[0].equipmentId).toBe(equipment.id);
  const scarce=await db.material.create({data:{companyId,sku:randomUUID(),description:'Scarce part',unit:'UN',averageCost:3,salePrice:9,stockQuantity:1}});
  const racePayload={equipmentId:equipment.id,serviceTypeIds:[serviceA.id],materials:[{materialId:scarce.id,quantity:1}],discount:0,surcharge:0};
  const raced=await Promise.all([call('POST','/service-orders/maintenance/start',racePayload),call('POST','/service-orders/maintenance/start',racePayload)]);
  expect(raced.map(x=>x.statusCode).sort()).toEqual([201,409]);
  expect(Number((await db.material.findUniqueOrThrow({where:{id:scarce.id}})).stockQuantity)).toBe(0);
  expect(await db.inventoryMovement.count({where:{materialId:scarce.id}})).toBe(1);
  const parallel=await Promise.all([
   call('POST','/service-orders/maintenance/start',{equipmentId:equipment.id,serviceTypeIds:[serviceA.id],materials:[],discount:0,surcharge:0}),
   call('POST','/service-orders/maintenance/start',{equipmentId:equipment.id,serviceTypeIds:[serviceA.id],materials:[],discount:0,surcharge:0})
  ]);
  expect(parallel.map(x=>x.statusCode)).toEqual([201,201]);
  expect(new Set(parallel.map(x=>x.json().order.orderNumber)).size).toBe(2);
 },30000);
 afterAll(async()=>{await app?.close();await db?.$disconnect();if(privateRoot)await rm(privateRoot,{recursive:true,force:true})});
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
  const variance=await call('GET','/management-finance/planned-vs-actual');expect(variance.statusCode).toBe(200);
  expect(variance.json()).toContainEqual(expect.objectContaining({orderNumber:os.orderNumber,plannedRevenue:500,actualRevenue:500,plannedProfit:400,actualProfit:400}));
  const foreignVariance=await call('GET','/management-finance/planned-vs-actual',undefined,foreignToken);expect(foreignVariance.statusCode).toBe(200);
  expect(foreignVariance.json().some((x:any)=>x.orderNumber===os.orderNumber)).toBe(false);
  const technician=app.jwt.sign({id:userId,companyId,role:'TECNICO',permissions:[]});
  expect((await call('GET','/management-finance/planned-vs-actual',undefined,technician)).statusCode).toBe(403);
  expect((await db.serviceOrder.findUniqueOrThrow({where:{id:os.id}})).status).toBe('RECEIVED');
  expect((await call('GET',`/customers/${customer.id}`,undefined,foreignToken)).statusCode).toBe(404);
 },30000);
});
