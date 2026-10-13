import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthUser } from '../lib/auth.js';

const createMaterial=z.object({
 sku:z.string().min(1).max(50),
 description:z.string().min(2).max(200),
 category:z.string().max(100).optional(),
 unit:z.string().min(1).max(20).default('UN'),
 averageCost:z.number().nonnegative().default(0),
 salePrice:z.number().nonnegative().default(0),
 stockQuantity:z.number().nonnegative().default(0),
 minimumStock:z.number().nonnegative().default(0)
});

export async function materialRoutes(app:FastifyInstance){
 app.addHook('preHandler',async r=>r.jwtVerify());
 app.get('/',async req=>{
  const u=req.user as AuthUser;
  return prisma.material.findMany({where:{companyId:u.companyId,active:true},orderBy:{description:'asc'}});
 });
 app.post('/',async(req,reply)=>{
  const u=req.user as AuthUser,p=createMaterial.safeParse(req.body);
  if(!p.success)return reply.code(422).send({message:'Dados do material inválidos.',details:p.error.flatten()});
  try{
   const material=await prisma.material.create({data:{...p.data,companyId:u.companyId,lastCost:p.data.averageCost}});
   return reply.code(201).send(material);
  }catch(e:any){
   if(e?.code==='P2002')return reply.code(409).send({message:'Já existe uma peça/material com este código.'});
   throw e;
  }
 });
 app.patch('/:id',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as {id:string};const p=createMaterial.partial().safeParse(req.body);if(!p.success)return reply.code(422).send({message:'Dados do material inválidos.',details:p.error.flatten()});const item=await prisma.material.findFirst({where:{id,companyId:u.companyId,active:true}});if(!item)return reply.code(404).send({message:'Peça/material não encontrado.'});try{return await prisma.material.update({where:{id},data:{...p.data,...(p.data.averageCost!=null?{lastCost:p.data.averageCost}:{})}})}catch(e:any){if(e?.code==='P2002')return reply.code(409).send({message:'Já existe uma peça/material com este código.'});throw e}});
 app.delete('/:id',async(req,reply)=>{const u=req.user as AuthUser,{id}=req.params as {id:string};const item=await prisma.material.findFirst({where:{id,companyId:u.companyId,active:true}});if(!item)return reply.code(404).send({message:'Peça/material não encontrado.'});await prisma.material.update({where:{id},data:{active:false}});return reply.code(204).send()});
}
