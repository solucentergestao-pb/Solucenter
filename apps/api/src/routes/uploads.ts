import {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import {prisma} from '../lib/prisma.js';
import {AuthUser} from '../lib/auth.js';
import {fail} from '../lib/errors.js';
import {can} from '../lib/security.js';
import {deletePrivateImage,imageExtension,photoDownloadUrl,privateStorageReady,readPrivateImage,savePrivateImage} from '../lib/privateStorage.js';

const categories=z.enum(['BEFORE','DURING','AFTER','NAMEPLATE','DEFECT','INSTALLATION','OTHER']);
type Principal=AuthUser&{customerId?:string;kind?:string};
const photoDto=(photo:{id:string;category:string;description?:string|null},kind:'equipment'|'service-order')=>({id:photo.id,category:photo.category,description:photo.description,downloadUrl:photoDownloadUrl(kind,photo.id)});

async function principal(req:FastifyRequest,reply:any):Promise<Principal|null>{try{await req.jwtVerify();return req.user as Principal;}catch{fail(reply,401,'UNAUTHORIZED','Autenticação necessária.');return null;}}
async function image(req:FastifyRequest,reply:any):Promise<{content:Buffer;extension:string;category:z.infer<typeof categories>}|null>{
 try{
  const part=await req.file({limits:{fileSize:8*1024*1024}});
  if(!part){fail(reply,422,'INVALID_FILE','Envie uma imagem JPG, PNG ou WEBP de até 8 MB.');return null;}
  const content=await part.toBuffer();
  const extension=imageExtension(part.mimetype,content);
  const category=categories.safeParse((part.fields.category as any)?.value??'OTHER');
  if(!extension||!category.success){fail(reply,422,'INVALID_FILE','A extensão, o conteúdo ou a categoria da imagem é inválida.');return null;}
  return {content,extension,category:category.data};
 }catch(e:any){
  if(e?.code==='FST_REQ_FILE_TOO_LARGE'){fail(reply,413,'FILE_TOO_LARGE','A imagem deve ter no máximo 8 MB.');return null;}
  throw e;
 }
}

export async function uploadRoutes(app:FastifyInstance){
 app.post('/equipment/:id/photo',async(req,reply)=>{
  const u=await principal(req,reply);if(!u)return;const {id}=req.params as {id:string};
  if(!can(u,'equipment.update'))return fail(reply,403,'FORBIDDEN','Acesso não autorizado.');
  const eq=await prisma.equipment.findFirst({where:{id,companyId:u.companyId}});
  if(!eq)return fail(reply,404,'EQUIPMENT_NOT_FOUND','Equipamento não encontrado.');
  const data=await image(req,reply);if(!data||reply.sent)return;
  if(!privateStorageReady())return fail(reply,503,'PRIVATE_STORAGE_UNAVAILABLE','Armazenamento privado não configurado.');
  const fileUrl=await savePrivateImage(u.companyId,'equipment',data.extension,data.content);
  const photo=await prisma.equipmentPhoto.create({data:{equipmentId:id,category:data.category,fileUrl}}).catch(async e=>{await deletePrivateImage(fileUrl);throw e;});
  return reply.code(201).send(photoDto(photo,'equipment'));
 });
 app.post('/service-orders/:id/photo',async(req,reply)=>{
  const u=await principal(req,reply);if(!u)return;const {id}=req.params as {id:string};
  if(!can(u,'service_order.photo.create'))return fail(reply,403,'FORBIDDEN','Acesso não autorizado.');
  const os=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId}});
  if(!os)return fail(reply,404,'SERVICE_ORDER_NOT_FOUND','OS não encontrada.');
  const data=await image(req,reply);if(!data||reply.sent)return;
  if(!privateStorageReady())return fail(reply,503,'PRIVATE_STORAGE_UNAVAILABLE','Armazenamento privado não configurado.');
  const fileUrl=await savePrivateImage(u.companyId,'service-orders',data.extension,data.content);
  const photo=await prisma.servicePhoto.create({data:{serviceOrderId:id,category:data.category,fileUrl}}).catch(async e=>{await deletePrivateImage(fileUrl);throw e;});
  return reply.code(201).send(photoDto(photo,'service-order'));
 });
 app.get('/equipment-photos/:id',async(req,reply)=>{
  const u=await principal(req,reply);if(!u)return;const {id}=req.params as {id:string};
  if(u.kind!=='customer'&&!can(u,'equipment.read'))return fail(reply,403,'FORBIDDEN','Acesso não autorizado.');
  const photo=await prisma.equipmentPhoto.findFirst({where:{id,equipment:{companyId:u.companyId,...(u.kind==='customer'?{customerId:u.customerId}:{})}}});
  if(!photo)return fail(reply,404,'PHOTO_NOT_FOUND','Foto não encontrada.');
  if(!privateStorageReady())return fail(reply,503,'PRIVATE_STORAGE_UNAVAILABLE','Armazenamento privado não configurado.');
  const stored=await readPrivateImage(photo.fileUrl,u.companyId).catch(()=>null);
  if(!stored)return fail(reply,404,'PHOTO_NOT_FOUND','Foto não encontrada.');
  return reply.type(stored.type).header('Content-Disposition','inline').send(stored.file);
 });
 app.get('/service-order-photos/:id',async(req,reply)=>{
  const u=await principal(req,reply);if(!u)return;const {id}=req.params as {id:string};
  if(u.kind!=='customer'&&!can(u,'service_order.read'))return fail(reply,403,'FORBIDDEN','Acesso não autorizado.');
  const photo=await prisma.servicePhoto.findFirst({where:{id,serviceOrder:{companyId:u.companyId,...(u.kind==='customer'?{customerId:u.customerId}:{})}}});
  if(!photo)return fail(reply,404,'PHOTO_NOT_FOUND','Foto não encontrada.');
  if(!privateStorageReady())return fail(reply,503,'PRIVATE_STORAGE_UNAVAILABLE','Armazenamento privado não configurado.');
  const stored=await readPrivateImage(photo.fileUrl,u.companyId).catch(()=>null);
  if(!stored)return fail(reply,404,'PHOTO_NOT_FOUND','Foto não encontrada.');
  return reply.type(stored.type).header('Content-Disposition','inline').send(stored.file);
 });
}
