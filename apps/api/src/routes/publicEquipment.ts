import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {prisma} from '../lib/prisma.js';
import {fail} from '../lib/errors.js';

const tokenSchema=z.string().regex(/^[a-f0-9]{48}$/);

export async function publicEquipmentRoutes(app:FastifyInstance){
 app.get('/:token',async(req,reply)=>{
  const parsed=tokenSchema.safeParse((req.params as {token?:string}).token);
  if(!parsed.success)return fail(reply,404,'EQUIPMENT_NOT_FOUND','Equipamento indisponível.');
  const qr=await prisma.equipmentQr.findFirst({where:{token:parsed.data,active:true,revokedAt:null},include:{equipment:{include:{company:true,unit:true,environment:true,model:{include:{manufacturer:true}}}}}});
  if(!qr)return fail(reply,404,'EQUIPMENT_NOT_FOUND','Equipamento indisponível.');
  const e=qr.equipment;reply.header('Cache-Control','no-store');
  return {company:{name:e.company.tradeName,logoUrl:e.company.logoUrl},equipment:{assetCode:e.assetCode,equipmentType:e.equipmentType,capacityBtu:e.capacityBtu,technology:e.technology,cycle:e.cycle,voltage:e.voltage,refrigerant:e.refrigerant,model:e.model?`${e.model.manufacturer.name} ${e.model.name}`:null,status:e.status,unit:e.unit.name,environment:e.environment?.name??null}};
 });
}
