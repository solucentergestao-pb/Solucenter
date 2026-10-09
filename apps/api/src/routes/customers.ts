import {FastifyInstance} from 'fastify';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../lib/prisma.js';
import {AuthUser} from '../lib/auth.js';
import {fail} from '../lib/errors.js';

const optionalText=z.preprocess(v=>typeof v==='string'&&v.trim()===''?undefined:v,z.string().trim().optional());
const unitSchema=z.object({name:z.string().trim().min(2),cep:optionalText,street:optionalText,number:optionalText,complement:optionalText,neighborhood:optionalText,city:optionalText,state:z.preprocess(v=>typeof v==='string'&&v.trim()===''?undefined:v,z.string().trim().toUpperCase().length(2).optional()),reference:optionalText});
const customerSchema=z.object({type:z.enum(['PF','PJ']),name:z.string().trim().min(2),legalName:optionalText,tradeName:optionalText,cpfCnpj:optionalText,phone:optionalText,whatsapp:optionalText,email:z.preprocess(v=>typeof v==='string'&&v.trim()===''?undefined:v,z.string().trim().email().optional()),notes:optionalText,firstUnit:unitSchema.optional()});

export async function customerRoutes(app:FastifyInstance){app.addHook('preHandler',async r=>r.jwtVerify());
 app.get('/',async req=>{const u=req.user as AuthUser;const q=z.object({search:z.string().optional()}).parse(req.query);return prisma.customer.findMany({where:{companyId:u.companyId,active:true,...(q.search?{OR:[{name:{contains:q.search,mode:'insensitive'}},{cpfCnpj:{contains:q.search}}]}:{})},include:{units:true},orderBy:{name:'asc'}})});
 app.post('/',async(req,reply)=>{const u=req.user as AuthUser,p=customerSchema.safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Corrija os campos informados.',p.error.flatten());const {firstUnit,...data}=p.data;try{const customer=await prisma.$transaction(async tx=>{const count=await tx.customer.count({where:{companyId:u.companyId}});const created=await tx.customer.create({data:{...data,companyId:u.companyId,code:`CLI-${String(count+1).padStart(6,'0')}`}});if(firstUnit)await tx.customerUnit.create({data:{customerId:created.id,...firstUnit}});return tx.customer.findUniqueOrThrow({where:{id:created.id},include:{units:true}})});return reply.code(201).send(customer)}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return fail(reply,409,'CUSTOMER_CONFLICT','CPF/CNPJ ou código já cadastrado.');throw error}});
 app.get('/:id',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;const c=await prisma.customer.findFirst({where:{id,companyId:u.companyId},include:{units:{include:{environments:true}},equipment:true}});return c??fail(reply,404,'CUSTOMER_NOT_FOUND','Cliente não encontrado.')});
 app.post('/:id/units',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as any;const p=unitSchema.safeParse(req.body);if(!p.success)return fail(reply,422,'VALIDATION_ERROR','Unidade inválida.',p.error.flatten());const owner=await prisma.customer.findFirst({where:{id,companyId:u.companyId}});if(!owner)return fail(reply,404,'CUSTOMER_NOT_FOUND','Cliente não encontrado.');return reply.code(201).send(await prisma.customerUnit.create({data:{customerId:id,...p.data}}))});
}
