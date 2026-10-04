import { FastifyInstance } from 'fastify';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthUser } from '../lib/auth.js';
import { fail } from '../lib/errors.js';

const allowed=new Set(['image/jpeg','image/png','image/webp']);
const categories=new Set(['BEFORE','DURING','AFTER','NAMEPLATE','DEFECT','INSTALLATION','OTHER']);
const servicePhotoPrefix='/uploads/service-orders/';
function mimeFromName(name:string){return name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg';}
function storedServicePhotoName(fileUrl:string){
 if(!fileUrl.startsWith(servicePhotoPrefix))return null;
 const name=fileUrl.slice(servicePhotoPrefix.length);
 return /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(name)?name:null;
}

export async function uploadRoutes(app:FastifyInstance){
 app.post('/equipment/:id/photo',async(req,reply)=>{
  await req.jwtVerify();
  const u=req.user as AuthUser,{id}=req.params as {id:string};
  if(!z.string().uuid().safeParse(id).success)return fail(reply,404,'EQUIPMENT_NOT_FOUND','Equipamento não encontrado.');
  const eq=await prisma.equipment.findFirst({where:{id,companyId:u.companyId}});
  if(!eq)return fail(reply,404,'EQUIPMENT_NOT_FOUND','Equipamento não encontrado.');
  const part=await req.file({limits:{fileSize:8*1024*1024}});
  if(!part||!allowed.has(part.mimetype))return fail(reply,422,'INVALID_FILE','Envie JPG, PNG ou WEBP de até 8 MB.');
  const ext=part.mimetype==='image/png'?'.png':part.mimetype==='image/webp'?'.webp':'.jpg';
  const name=crypto.randomUUID()+ext;
  const dir=path.resolve('uploads/equipment');
  await mkdir(dir,{recursive:true});
  await pipeline(part.file,createWriteStream(path.join(dir,name)));
  const rawCategory=String((part.fields.category as any)?.value??'OTHER');
  const category=categories.has(rawCategory)?rawCategory:'OTHER';
  const photo=await prisma.equipmentPhoto.create({data:{equipmentId:id,category:category as any,fileUrl:`/uploads/equipment/${name}`}});
  return reply.code(201).send(photo);
 });

 app.post('/service-orders/:id/photo',async(req,reply)=>{
  await req.jwtVerify();
  const u=req.user as AuthUser,{id}=req.params as {id:string};
  if(!z.string().uuid().safeParse(id).success)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');
  const os=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId}});
  if(!os)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');
  const part=await req.file({limits:{fileSize:8*1024*1024}});
  if(!part||!allowed.has(part.mimetype))return fail(reply,422,'INVALID_FILE','Envie JPG, PNG ou WEBP de até 8 MB.');
  const ext=part.mimetype==='image/png'?'.png':part.mimetype==='image/webp'?'.webp':'.jpg';
  const name=crypto.randomUUID()+ext;
  const dir=path.resolve('uploads/service-orders');
  await mkdir(dir,{recursive:true});
  await pipeline(part.file,createWriteStream(path.join(dir,name)));
  const rawCategory=String((part.fields.category as any)?.value??'OTHER');
  const category=categories.has(rawCategory)?rawCategory:'OTHER';
  const photo=await prisma.servicePhoto.create({data:{serviceOrderId:id,category:category as any,fileUrl:`${servicePhotoPrefix}${name}`}});
  return reply.code(201).send({...photo,fileUrl:`/api/v1/uploads/service-orders/${id}/photos/${photo.id}/content`});
 });

 app.get('/service-orders/:id/photos/:photoId/content',async(req,reply)=>{
  await req.jwtVerify();
  const u=req.user as AuthUser,{id,photoId}=req.params as {id:string;photoId:string};
  if(!z.string().uuid().safeParse(id).success||!z.string().uuid().safeParse(photoId).success)return fail(reply,404,'PHOTO_NOT_FOUND','Foto não encontrada.');
  const photo=await prisma.servicePhoto.findFirst({where:{id:photoId,serviceOrderId:id,serviceOrder:{companyId:u.companyId}}});
  if(!photo)return fail(reply,404,'PHOTO_NOT_FOUND','Foto não encontrada.');
  const name=storedServicePhotoName(photo.fileUrl);
  if(!name)return fail(reply,409,'PHOTO_STORAGE_UNAVAILABLE','Esta foto ainda não está disponível no armazenamento privado.');
  reply.header('Content-Type',mimeFromName(name));
  reply.header('Cache-Control','private, no-store');
  reply.header('Content-Disposition','inline');
  return reply.send(createReadStream(path.resolve('uploads/service-orders',name)));
 });
}
