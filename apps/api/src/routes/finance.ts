import {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {prisma} from '../lib/prisma.js';
import {AuthUser} from '../lib/auth.js';
import {fail} from '../lib/errors.js';
import {receivableAfterPayment} from '../lib/commercial.js';

export async function financeRoutes(app:FastifyInstance){
 app.addHook('preHandler',async r=>r.jwtVerify());
 app.get('/receivables',async req=>{
  const u=req.user as AuthUser;
  return prisma.accountReceivable.findMany({where:{companyId:u.companyId},include:{customer:true,serviceOrder:true,payments:true},orderBy:{dueDate:'asc'}});
 });
 app.post('/receivables',async(req,reply)=>{
  const u=req.user as AuthUser;
  const p=z.object({customerId:z.string().uuid(),serviceOrderId:z.string().uuid().optional(),quoteId:z.string().uuid().optional(),description:z.string().min(2),amount:z.number().positive(),dueDate:z.coerce.date()}).safeParse(req.body);
  if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Cobrança inválida.',p.error.flatten());
  try{
   const result=await prisma.$transaction(async tx=>{
    const customer=await tx.customer.findFirst({where:{id:p.data.customerId,companyId:u.companyId,active:true}});
    if(!customer)throw new Error('CUSTOMER_NOT_FOUND');
    let quoteId=p.data.quoteId;
    if(quoteId){
     const quote=await tx.quote.findFirst({where:{id:quoteId,companyId:u.companyId,customerId:customer.id}});
     if(!quote)throw new Error('INVALID_RELATION');
    }
    if(p.data.serviceOrderId){
     const os=await tx.serviceOrder.findFirst({where:{id:p.data.serviceOrderId,companyId:u.companyId,customerId:customer.id}});
     if(!os)throw new Error('INVALID_RELATION');
     if(quoteId&&quoteId!==os.quoteId)throw new Error('INVALID_RELATION');
     quoteId=os.quoteId??undefined;
     if(os.status!=='COMPLETED')throw new Error('NOT_COMPLETED');
     // Shared claim with the OS invoice route. The row lock lasts through commit.
     const claimed=await tx.serviceOrder.updateMany({where:{id:os.id,companyId:u.companyId,status:'COMPLETED'},data:{status:'INVOICED'}});
     if(claimed.count!==1)throw new Error('INVOICE_CONFLICT');
     const existing=await tx.accountReceivable.findFirst({where:{serviceOrderId:os.id,status:{not:'CANCELLED'}}});
     if(existing)throw new Error('INVOICE_CONFLICT');
     await tx.serviceOrderStatusHistory.create({data:{serviceOrderId:os.id,previousStatus:'COMPLETED',newStatus:'INVOICED',userId:u.id}});
    }
    return tx.accountReceivable.create({data:{companyId:u.companyId,customerId:customer.id,serviceOrderId:p.data.serviceOrderId,quoteId,description:p.data.description,originalAmount:p.data.amount,openAmount:p.data.amount,dueDate:p.data.dueDate}});
   });
   return reply.code(201).send(result);
  }catch(e:any){
   const errors:Record<string,[number,string,string]>={
    CUSTOMER_NOT_FOUND:[404,'CUSTOMER_NOT_FOUND','Cliente não encontrado.'],
    INVALID_RELATION:[422,'INVALID_RELATION','OS ou orçamento não pertence ao cliente informado.'],
    NOT_COMPLETED:[409,'SERVICE_ORDER_NOT_COMPLETED','Conclua a OS antes de cobrar.'],
    INVOICE_CONFLICT:[409,'RECEIVABLE_EXISTS','Esta OS já foi faturada ou está sendo faturada.'],
   };
   const error=errors[e.message];
   return error?fail(reply,...error):fail(reply,500,'RECEIVABLE_ERROR','Não foi possível criar a cobrança.');
  }
 });
 app.post('/receivables/:id/payments',async(req,reply)=>{
  const u=req.user as AuthUser,{id}=req.params as {id:string};
  const p=z.object({amount:z.number().positive(),paymentMethod:z.enum(['PIX','CASH','CREDIT_CARD','DEBIT_CARD','TRANSFER','BOLETO','OTHER']),transactionReference:z.string().optional(),notes:z.string().optional(),paymentDate:z.coerce.date().optional()}).safeParse(req.body);
  if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Pagamento inválido.',p.error.flatten());
  if(!z.string().uuid().safeParse(id).success)return fail(reply,404,'RECEIVABLE_NOT_FOUND','Cobrança não encontrada.');
  try{
   return await prisma.$transaction(async tx=>{
    const r=await tx.accountReceivable.findFirst({where:{id,companyId:u.companyId}});
    if(!r)throw new Error('NOT_FOUND');
    if(r.status==='PAID'||r.status==='CANCELLED')throw new Error('CLOSED');
    const next=receivableAfterPayment(Number(r.openAmount),p.data.amount);
    // Only the request based on this exact balance/status can commit a payment.
    const claimed=await tx.accountReceivable.updateMany({where:{id,companyId:u.companyId,openAmount:r.openAmount,status:r.status},data:next});
    if(claimed.count!==1)throw new Error('PAYMENT_CONFLICT');
    const payment=await tx.payment.create({data:{receivableId:id,amount:p.data.amount,paymentMethod:p.data.paymentMethod,paymentDate:p.data.paymentDate??new Date(),transactionReference:p.data.transactionReference,notes:p.data.notes,receivedById:u.id}});
    const updated=await tx.accountReceivable.findUniqueOrThrow({where:{id}});
    if(next.status==='PAID'&&r.serviceOrderId)await tx.serviceOrder.updateMany({where:{id:r.serviceOrderId,companyId:u.companyId,status:'INVOICED'},data:{status:'RECEIVED'}});
    return {payment,receivable:updated};
   });
  }catch(e:any){
   if(e.message==='PAYMENT_EXCEEDS_BALANCE')return fail(reply,409,'PAYMENT_EXCEEDS_BALANCE','Pagamento maior que o saldo em aberto.');
   if(e.message==='CLOSED')return fail(reply,409,'RECEIVABLE_CLOSED','Cobrança já está encerrada.');
   if(e.message==='PAYMENT_CONFLICT')return fail(reply,409,'PAYMENT_CONFLICT','O saldo foi atualizado por outro pagamento. Atualize a cobrança antes de tentar novamente.');
   if(e.message==='NOT_FOUND')return fail(reply,404,'RECEIVABLE_NOT_FOUND','Cobrança não encontrada.');
   return fail(reply,500,'PAYMENT_ERROR','Não foi possível registrar o pagamento.');
  }
 });
}
