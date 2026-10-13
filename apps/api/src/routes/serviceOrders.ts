import { FastifyInstance } from 'fastify'; import { z } from 'zod'; import { Prisma } from '@prisma/client'; import { prisma } from '../lib/prisma.js'; import { AuthUser } from '../lib/auth.js'; import { fail } from '../lib/errors.js'; import { can } from '../lib/security.js';
const create=z.object({customerId:z.string().uuid(),unitId:z.string().uuid(),environmentId:z.string().uuid().optional(),equipmentId:z.string().uuid().optional(),serviceTypeId:z.string().uuid().optional(),priority:z.enum(['LOW','NORMAL','HIGH','URGENT']).default('NORMAL'),reportedProblem:z.string().min(3),scheduledAt:z.coerce.date().optional(),technicianIds:z.array(z.string().uuid()).default([])});
const money=z.number().finite().nonnegative().max(9_999_999_999.99).refine(v=>new Prisma.Decimal(v).decimalPlaces()<=2,'Use no máximo duas casas decimais.');
const materialQuantity=z.number().positive().max(999_999.999).refine(v=>new Prisma.Decimal(v).decimalPlaces()<=3,'Use no máximo três casas decimais.');
const maintenanceStart=z.object({
 equipmentId:z.string().uuid(),
 serviceTypeIds:z.array(z.string().uuid()).min(1).max(20),
 materials:z.array(z.object({materialId:z.string().uuid(),quantity:materialQuantity})).max(50).default([]),
 observation:z.string().max(4000).optional(),
 discount:money.default(0),
 surcharge:money.default(0),
 reminderDays:z.number().int().min(1).max(3650).optional()
}).superRefine((v,ctx)=>{
 if(new Set(v.serviceTypeIds).size!==v.serviceTypeIds.length)ctx.addIssue({code:'custom',path:['serviceTypeIds'],message:'Não repita serviços.'});
 if(new Set(v.materials.map(x=>x.materialId)).size!==v.materials.length)ctx.addIssue({code:'custom',path:['materials'],message:'Não repita materiais.'});
});
export async function serviceOrderRoutes(app:FastifyInstance){app.addHook('preHandler',async(req,reply)=>{
  await req.jwtVerify();
  const u=req.user as AuthUser;
  const route=req.routeOptions.url??'';
  let permission:string|undefined;
  if(route.endsWith('/invoice'))permission='finance.write';
  else if(route.endsWith('/profitability'))permission='profit.read';
  else if(req.method==='GET')permission='service_order.read';
  else if(route.endsWith('/measurements'))permission='service_order.measurement.create';
  else if(route.endsWith('/materials'))permission='service_order.material.create';
  else if(route.endsWith('/complete'))permission='service_order.complete';
  else if(route.endsWith('/maintenance/start'))permission='service_order.create';
  else if(route.endsWith('/start')||route.endsWith('/preparation'))permission='service_order.update';
  else if(req.method==='POST')permission='service_order.create';
  if(permission&&!can(u,permission))return fail(reply,403,'FORBIDDEN','Acesso não autorizado.');
  const {id}=req.params as {id?:string};
  if(id){
   if(!z.string().uuid().safeParse(id).success)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');
   const order=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId}});
   if(!order)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');
  }
 });
 app.get('/',async req=>{const u=req.user as AuthUser;return prisma.serviceOrder.findMany({where:{companyId:u.companyId},include:{customer:true,unit:true,equipment:true,technicians:{include:{user:true}}},orderBy:{createdAt:'desc'}})});
 app.get('/service-types',async req=>{const u=req.user as AuthUser;return prisma.serviceType.findMany({where:{companyId:u.companyId,active:true},orderBy:{name:'asc'}})});
 app.post('/service-types',async(req,reply)=>{const u=req.user as AuthUser,p=z.object({name:z.string().min(2).max(120),basePrice:z.number().nonnegative().default(0)}).safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Dados do serviço inválidos.',p.error.flatten());try{return reply.code(201).send(await prisma.serviceType.create({data:{companyId:u.companyId,name:p.data.name,basePrice:p.data.basePrice}}))}catch(e:any){if(e?.code==='P2002')return fail(reply,409,'SERVICE_TYPE_EXISTS','Já existe um serviço com este nome.');throw e}});
 app.post('/maintenance/start',async(req,reply)=>{
  const u=req.user as AuthUser,p=maintenanceStart.safeParse(req.body);
  if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Dados da manutenção inválidos.',p.error.flatten());
  if(p.data.materials.length&&!can(u,'service_order.material.create'))return fail(reply,403,'FORBIDDEN','Acesso não autorizado para utilizar materiais.');
  if(p.data.reminderDays&&!can(u,'maintenance.create'))return fail(reply,403,'FORBIDDEN','Acesso não autorizado para criar lembrete preventivo.');
  try{
   const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${u.companyId}),hashtext('maintenance_start'))`);
    const equipment=await tx.equipment.findFirst({where:{id:p.data.equipmentId,companyId:u.companyId,status:{not:'REMOVED'}},include:{customer:true}});
    if(!equipment||!equipment.customer.active)throw new Error('INVALID_EQUIPMENT');
    const services=await tx.serviceType.findMany({where:{id:{in:p.data.serviceTypeIds},companyId:u.companyId,active:true}});
    if(services.length!==p.data.serviceTypeIds.length)throw new Error('INVALID_SERVICE');
    const materials=p.data.materials.length?await tx.material.findMany({where:{id:{in:p.data.materials.map(x=>x.materialId)},companyId:u.companyId,active:true}}):[];
    if(materials.length!==p.data.materials.length)throw new Error('INVALID_MATERIAL');
    const serviceTotal=services.reduce((sum,x)=>sum+Number(x.basePrice),0);
    const materialTotal=p.data.materials.reduce((sum,row)=>sum+Number(materials.find(x=>x.id===row.materialId)!.salePrice)*row.quantity,0);
    const quotedValue=Math.max(0,serviceTotal+materialTotal+p.data.surcharge-p.data.discount);
    if(quotedValue>9_999_999_999.99)throw new Error('TOTAL_TOO_LARGE');
    const count=await tx.serviceOrder.count({where:{companyId:u.companyId}});
    const names=p.data.serviceTypeIds.map(id=>services.find(x=>x.id===id)!.name);
    const order=await tx.serviceOrder.create({data:{
     companyId:u.companyId,orderNumber:`OS-${String(count+1).padStart(6,'0')}`,customerId:equipment.customerId,unitId:equipment.unitId,
     environmentId:equipment.environmentId,equipmentId:equipment.id,serviceTypeId:p.data.serviceTypeIds[0],priority:'NORMAL',status:'IN_PROGRESS',
     reportedProblem:p.data.observation?.trim()||`Manutenção: ${names.join(', ')}`,performedService:names.join('; '),quotedValue,createdById:u.id,startedAt:new Date(),
     statusHistory:{create:[{newStatus:'OPEN',userId:u.id},{previousStatus:'OPEN',newStatus:'IN_PROGRESS',userId:u.id}]}
    }});
    for(const row of p.data.materials){
     const material=materials.find(x=>x.id===row.materialId)!;
     const claimed=await tx.material.updateMany({where:{id:material.id,companyId:u.companyId,stockQuantity:{gte:row.quantity}},data:{stockQuantity:{decrement:row.quantity}}});
     if(claimed.count!==1)throw new Error('INSUFFICIENT_STOCK');
     await tx.serviceOrderMaterial.create({data:{serviceOrderId:order.id,materialId:material.id,quantity:row.quantity,unitCost:material.averageCost,unitPrice:material.salePrice}});
     await tx.inventoryMovement.create({data:{materialId:material.id,movementType:'SERVICE_USAGE',quantity:-row.quantity,unitCost:material.averageCost,serviceOrderId:order.id,userId:u.id}});
    }
    let reminderPlanId:string|undefined;
    if(p.data.reminderDays){
     const first=new Date();first.setDate(first.getDate()+p.data.reminderDays);
     const second=new Date(first);second.setDate(second.getDate()+p.data.reminderDays);
     const plan=await tx.maintenancePlan.create({data:{companyId:u.companyId,customerId:equipment.customerId,name:`Retorno ${equipment.assetCode}`,frequency:'CUSTOM',intervalDays:p.data.reminderDays,startDate:first,notes:`Lembrete criado ao iniciar manutenção ${order.orderNumber}`,equipment:{create:{equipmentId:equipment.id}},occurrences:{create:[{dueAt:first},{dueAt:second}]}},select:{id:true}});
     reminderPlanId=plan.id;
    }
    return {order,reminderPlanId};
   });
   return reply.code(201).send(result);
  }catch(error:any){
   const known:Record<string,[number,string,string]>={
    INVALID_EQUIPMENT:[422,'INVALID_EQUIPMENT','Equipamento indisponível para esta empresa.'],
    INVALID_SERVICE:[422,'INVALID_SERVICE','Um ou mais serviços estão indisponíveis.'],
    INVALID_MATERIAL:[422,'INVALID_MATERIAL','Um ou mais materiais estão indisponíveis.'],
    TOTAL_TOO_LARGE:[422,'TOTAL_TOO_LARGE','O valor total excede o limite permitido.'],
    INSUFFICIENT_STOCK:[409,'INSUFFICIENT_STOCK','Estoque insuficiente.']
   };
   const item=known[error?.message];if(item)return fail(reply,item[0],item[1],item[2]);
   if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return fail(reply,409,'ORDER_NUMBER_CONFLICT','Não foi possível reservar o número da OS.');
   throw error;
  }
 });
 app.post('/',async(req,reply)=>{const u=req.user as AuthUser,p=create.safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Dados da OS inválidos.',p.error.flatten());const unit=await prisma.customerUnit.findFirst({where:{id:p.data.unitId,customerId:p.data.customerId,customer:{companyId:u.companyId,active:true}}});
 if(!unit)return fail(reply,422,'INVALID_RELATION','Unidade não pertence ao cliente.');
 if(p.data.environmentId){const env=await prisma.environment.findFirst({where:{id:p.data.environmentId,unitId:p.data.unitId}});if(!env)return fail(reply,422,'INVALID_RELATION','Ambiente não pertence à unidade.');}
 if(p.data.equipmentId){const equipment=await prisma.equipment.findFirst({where:{id:p.data.equipmentId,companyId:u.companyId,customerId:p.data.customerId,unitId:p.data.unitId,...(p.data.environmentId?{environmentId:p.data.environmentId}:{})}});if(!equipment)return fail(reply,422,'INVALID_RELATION','Equipamento não pertence ao local informado.');}
 if(p.data.serviceTypeId){const service=await prisma.serviceType.findFirst({where:{id:p.data.serviceTypeId,companyId:u.companyId}});if(!service)return fail(reply,422,'INVALID_RELATION','Tipo de serviço não encontrado.');}
 const technicianIds=[...new Set(p.data.technicianIds)];
 if(technicianIds.length){const technicians=await prisma.user.count({where:{id:{in:technicianIds},companyId:u.companyId,status:'ACTIVE'}});if(technicians!==technicianIds.length)return fail(reply,422,'INVALID_RELATION','Responsável não pertence à empresa ou está inativo.');}
 const count=await prisma.serviceOrder.count({where:{companyId:u.companyId}});const {technicianIds:ignoredTechnicianIds,...base}=p.data;const os=await prisma.serviceOrder.create({data:{...base,companyId:u.companyId,orderNumber:`OS-${String(count+1).padStart(6,'0')}`,createdById:u.id,status:p.data.scheduledAt?'SCHEDULED':'OPEN',technicians:{create:technicianIds.map(userId=>({userId}))},statusHistory:{create:{newStatus:p.data.scheduledAt?'SCHEDULED':'OPEN',userId:u.id}}},include:{technicians:true}});return reply.code(201).send(os)});
 app.patch('/:id/preparation',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;const p=z.object({performedService:z.string().min(2).optional(),quotedValue:z.number().nonnegative().optional(),serviceTypeId:z.string().uuid().optional().nullable()}).safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Preparação da manutenção inválida.',p.error.flatten());const current=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId}});if(!current)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');if(!['OPEN','SCHEDULED','ASSIGNED','ON_THE_WAY','IN_PROGRESS'].includes(current.status))return fail(reply,409,'SERVICE_ORDER_LOCKED','Esta OS não pode mais ser preparada.');if(p.data.serviceTypeId){const service=await prisma.serviceType.findFirst({where:{id:p.data.serviceTypeId,companyId:u.companyId,active:true}});if(!service)return fail(reply,422,'INVALID_RELATION','Serviço não encontrado.');}return prisma.serviceOrder.update({where:{id},data:{performedService:p.data.performedService,quotedValue:p.data.quotedValue,serviceTypeId:p.data.serviceTypeId??undefined}})});
 app.post('/:id/measurements',async(req,reply)=>{const {id}=req.params as any;const p=z.object({voltage:z.number().optional(),current:z.number().optional(),returnTemperature:z.number().optional(),supplyTemperature:z.number().optional(),lowPressure:z.number().optional(),highPressure:z.number().optional(),superheat:z.number().optional(),subcooling:z.number().optional(),ambientTemperature:z.number().optional()}).safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Medição inválida.',p.error.flatten());const deltaT=p.data.returnTemperature!=null&&p.data.supplyTemperature!=null?p.data.returnTemperature-p.data.supplyTemperature:undefined;return reply.code(201).send(await prisma.serviceMeasurement.create({data:{serviceOrderId:id,...p.data,deltaT}}))});
 app.post('/:id/materials',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;const p=z.object({materialId:z.string().uuid(),quantity:z.number().positive()}).safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Material inválido.',p.error.flatten());try{const result=await prisma.$transaction(async tx=>{const m=await tx.material.findFirst({where:{id:p.data.materialId,companyId:u.companyId}});if(!m)throw new Error('NOT_FOUND');if(Number(m.stockQuantity)<p.data.quantity)throw new Error('INSUFFICIENT_STOCK');const item=await tx.serviceOrderMaterial.create({data:{serviceOrderId:id,materialId:m.id,quantity:p.data.quantity,unitCost:m.averageCost,unitPrice:m.salePrice}});await tx.material.update({where:{id:m.id},data:{stockQuantity:{decrement:p.data.quantity}}});await tx.inventoryMovement.create({data:{materialId:m.id,movementType:'SERVICE_USAGE',quantity:-p.data.quantity,unitCost:m.averageCost,serviceOrderId:id,userId:u.id}});return item});return reply.code(201).send(result)}catch(e:any){if(e.message==='INSUFFICIENT_STOCK')return fail(reply,409,'INSUFFICIENT_STOCK','Estoque insuficiente.');return fail(reply,404,'MATERIAL_NOT_FOUND','Material não encontrado.')}});
 app.post('/:id/complete',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;const p=z.object({technicalDiagnosis:z.string().min(3),performedService:z.string().min(3),recommendations:z.string().optional(),finalValue:z.number().nonnegative(),laborCost:z.number().nonnegative().default(0),travelCost:z.number().nonnegative().default(0),feesCost:z.number().nonnegative().default(0),otherCost:z.number().nonnegative().default(0)}).safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Finalização inválida.',p.error.flatten());const current=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId}});if(!current)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');if(!['IN_PROGRESS','WAITING_APPROVAL','WAITING_PARTS','OPEN','SCHEDULED'].includes(current.status))return fail(reply,409,'INVALID_STATUS_TRANSITION','Esta OS não pode ser concluída no status atual.');const os=await prisma.serviceOrder.update({where:{id},data:{...p.data,status:'COMPLETED',completedAt:new Date(),statusHistory:{create:{previousStatus:current.status,newStatus:'COMPLETED',userId:u.id}}}});return os});
 app.post('/:id/start',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;const current=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId}});if(!current)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');if(!['OPEN','SCHEDULED','ASSIGNED','ON_THE_WAY'].includes(current.status))return fail(reply,409,'INVALID_STATUS_TRANSITION','Esta OS não pode ser iniciada no status atual.');return prisma.serviceOrder.update({where:{id},data:{status:'IN_PROGRESS',startedAt:new Date(),statusHistory:{create:{previousStatus:current.status,newStatus:'IN_PROGRESS',userId:u.id}}}})});
 app.patch('/:id/financials',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;if(!can(u,'service_order.update')&&!can(u,'finance.write'))return fail(reply,403,'FORBIDDEN','Acesso não autorizado.');const p=z.object({finalValue:z.number().nonnegative(),laborCost:z.number().nonnegative().default(0),travelCost:z.number().nonnegative().default(0),feesCost:z.number().nonnegative().default(0),otherCost:z.number().nonnegative().default(0)}).safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Valores da OS inválidos.',p.error.flatten());const current=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId}});if(!current)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');if(current.status!=='COMPLETED')return fail(reply,409,'SERVICE_ORDER_LOCKED','Os valores só podem ser ajustados enquanto a OS estiver concluída e ainda não faturada.');return prisma.serviceOrder.update({where:{id},data:p.data})});
 app.post('/:id/invoice',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;const p=z.object({dueDate:z.coerce.date(),description:z.string().optional()}).safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Cobrança inválida.',p.error.flatten());try{return await prisma.$transaction(async tx=>{const os=await tx.serviceOrder.findFirst({where:{id,companyId:u.companyId}});if(!os)throw new Error('NOT_FOUND');if(os.status!=='COMPLETED')throw new Error('NOT_COMPLETED');const existing=await tx.accountReceivable.findFirst({where:{serviceOrderId:id,status:{not:'CANCELLED'}}});if(existing)throw new Error('EXISTS');const amount=Number(os.finalValue??os.quotedValue??0);if(amount<=0)throw new Error('NO_VALUE');const claimed=await tx.serviceOrder.updateMany({where:{id,companyId:u.companyId,status:'COMPLETED'},data:{status:'INVOICED'}});if(claimed.count!==1)throw new Error('EXISTS');const r=await tx.accountReceivable.create({data:{companyId:u.companyId,customerId:os.customerId,serviceOrderId:os.id,quoteId:os.quoteId,description:p.data.description??`Cobrança ${os.orderNumber}`,originalAmount:amount,openAmount:amount,dueDate:p.data.dueDate}});await tx.serviceOrder.update({where:{id},data:{status:'INVOICED',statusHistory:{create:{previousStatus:'COMPLETED',newStatus:'INVOICED',userId:u.id}}}});return r})}catch(e:any){const m:any={NOT_FOUND:[404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.'],NOT_COMPLETED:[409,'SERVICE_ORDER_NOT_COMPLETED','Conclua a OS antes de cobrar.'],EXISTS:[409,'RECEIVABLE_EXISTS','Já existe cobrança para esta OS.'],NO_VALUE:[409,'SERVICE_ORDER_NO_VALUE','A OS não possui valor para cobrança.']};const x=m[e.message];return x?fail(reply,x[0],x[1],x[2]):fail(reply,500,'INVOICE_ERROR','Não foi possível gerar a cobrança.')}});
 app.get('/:id/profitability',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;const os=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId},include:{materials:true,technicians:true}});if(!os)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');const material=os.materials.reduce((s,x)=>s+Number(x.quantity)*Number(x.unitCost),0);const labor=Number(os.laborCost)+os.technicians.reduce((s,x)=>s+Number(x.laborCost),0);const revenue=Number(os.finalValue??0),travel=Number(os.travelCost),fees=Number(os.feesCost),other=Number(os.otherCost),totalCost=material+labor+travel+fees+other,profit=revenue-totalCost,margin=revenue?profit/revenue*100:0;return {revenue,costs:{materials:material,labor,travel,fees,other},totalCost,profit,margin:Number(margin.toFixed(2))}});
}
