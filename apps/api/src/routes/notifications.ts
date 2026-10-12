import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {authenticate} from '../lib/auth.js';
import {prisma} from '../lib/prisma.js';
import {processNotificationQueue} from '../lib/notifications.js';

const eventType=z.enum(['QUOTE_SENT','QUOTE_APPROVED','MAINTENANCE_DUE','APPOINTMENT_SCHEDULED','TECHNICIAN_ON_THE_WAY','SERVICE_ORDER_COMPLETED','RECEIVABLE_CREATED','PAYMENT_RECEIVED','RECEIPT_ISSUED']);
const channel=z.enum(['IN_APP','WHATSAPP','EMAIL']);

export async function notificationRoutes(app:FastifyInstance){
 app.addHook('preHandler',authenticate);
 app.get('/',async(req:any)=>prisma.notification.findMany({where:{companyId:req.user.companyId},include:{deliveries:true},orderBy:{createdAt:'desc'},take:200}));
 app.get('/templates',async(req:any)=>prisma.notificationTemplate.findMany({where:{companyId:req.user.companyId},orderBy:[{eventType:'asc'},{channel:'asc'}]}));
 app.put('/templates/:event/:channel',async(req:any,reply)=>{
  const params=z.object({event:eventType,channel}).safeParse(req.params);
  const body=z.object({name:z.string().min(2),subject:z.string().optional(),body:z.string().min(2),active:z.boolean().default(true)}).safeParse(req.body);
  if(!params.success)return reply.code(422).send({error:{code:'VALIDATION_ERROR',details:params.error.flatten()}});
  if(!body.success)return reply.code(422).send({error:{code:'VALIDATION_ERROR',details:body.error.flatten()}});
  return prisma.notificationTemplate.upsert({where:{companyId_eventType_channel:{companyId:req.user.companyId,eventType:params.data.event,channel:params.data.channel}},create:{companyId:req.user.companyId,eventType:params.data.event,channel:params.data.channel,...body.data},update:body.data});
 });
 app.post('/process',async(req:any)=>processNotificationQueue(25,req.user.companyId));
 app.post('/:id/retry',async(req:any,reply)=>{
  const n=await prisma.notification.findFirst({where:{id:req.params.id,companyId:req.user.companyId}});
  if(!n)return reply.code(404).send({error:{code:'NOTIFICATION_NOT_FOUND'}});
  return prisma.notification.update({where:{id:n.id},data:{status:'PENDING',nextAttemptAt:new Date(),lastError:null}});
 });
}
