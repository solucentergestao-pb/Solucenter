import {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {prisma} from '../lib/prisma.js';
import {AuthUser} from '../lib/auth.js';
import {fail} from '../lib/errors.js';
import {createBusinessPdf} from '../lib/pdf.js';
import {deletePrivateDocument,privateStorageReady,readPrivateDocument} from '../lib/privateStorage.js';
import {permit} from '../lib/security.js';

const money=(n:any)=>Number(n??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const tokenSchema=z.string().regex(/^[0-9a-f]{48}$/);
const expiry=()=>new Date(Date.now()+Math.min(Math.max(Number(process.env.DOCUMENT_SHARE_DAYS??7),1),90)*86_400_000);
const shareUrl=(token:string)=>`${process.env.PUBLIC_API_URL??'http://localhost:3333'}/public/documents/${token}`;
const dto=(d:any)=>({id:d.id,type:d.type,entityId:d.entityId,expiresAt:d.expiresAt,createdAt:d.createdAt});

export async function documentRoutes(app:FastifyInstance){
 app.post('/quotes/:id/pdf',{preHandler:permit('document.write')},async(req,reply)=>{
  if(!privateStorageReady())return fail(reply,503,'PRIVATE_STORAGE_UNAVAILABLE','Armazenamento privado não configurado.');
  const u=req.user as AuthUser,{id}=req.params as {id:string};
  const q=await prisma.quote.findFirst({where:{id,companyId:u.companyId},include:{customer:true,items:true,company:true}});
  if(!q)return fail(reply,404,'QUOTE_NOT_FOUND','Orçamento não encontrado.');
  const pdf=await createBusinessPdf({companyId:u.companyId,title:'ORÇAMENTO COMERCIAL',number:q.quoteNumber,company:q.company.tradeName,logoUrl:q.company.logoUrl,customer:q.customer.name,lines:[{label:'Subtotal',value:money(q.subtotal)},{label:'Desconto',value:money(q.discount)},{label:'Total',value:money(q.total)},{label:'Validade',value:q.validUntil?.toLocaleDateString('pt-BR')??'-'}],sections:[{title:'Serviços e materiais',body:q.items.map(i=>`${i.description} — ${i.quantity} × ${money(i.unitPrice)} = ${money(Number(i.quantity)*Number(i.unitPrice))}`).join('\n')},{title:'Condições de pagamento',body:q.paymentTerms??'-'},{title:'Garantia',body:q.warrantyTerms??'-'},{title:'Observações',body:q.notes??'-'}],footer:`${q.company.tradeName} • Documento comercial Solucenter`});
  try{const d=await prisma.generatedDocument.create({data:{companyId:u.companyId,type:'QUOTE',entityId:q.id,fileUrl:pdf.fileUrl,publicToken:pdf.token,expiresAt:expiry()}});return {document:dto(d),shareUrl:shareUrl(pdf.token)};}
  catch(e){await deletePrivateDocument(pdf.fileUrl);throw e;}
 });
 app.post('/service-orders/:id/pdf',{preHandler:permit('document.write')},async(req,reply)=>{
  if(!privateStorageReady())return fail(reply,503,'PRIVATE_STORAGE_UNAVAILABLE','Armazenamento privado não configurado.');
  const u=req.user as AuthUser,{id}=req.params as {id:string};
  const o=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId},include:{customer:true,equipment:true,materials:{include:{material:true}},company:true,photos:true,signatures:{orderBy:{signedAt:'desc'},take:1},measurements:true}});
  if(!o)return fail(reply,404,'ORDER_NOT_FOUND','OS não encontrada.');
  const last=o.measurements.at(-1);
  const pdf=await createBusinessPdf({companyId:u.companyId,title:'ORDEM DE SERVIÇO / RELATÓRIO TÉCNICO',number:o.orderNumber,company:o.company.tradeName,logoUrl:o.company.logoUrl,customer:o.customer.name,lines:[{label:'Equipamento',value:o.equipment?.assetCode??'-'},{label:'Status',value:o.status},{label:'Valor do serviço',value:money(o.finalValue)},{label:'Medição ΔT',value:last?.deltaT?`${last.deltaT} °C`:'-'}],sections:[{title:'Problema relatado',body:o.reportedProblem},{title:'Diagnóstico técnico',body:o.technicalDiagnosis??'-'},{title:'Serviço executado',body:o.performedService??'-'},{title:'Materiais utilizados',body:o.materials.map(m=>`${m.material.description}: ${m.quantity} ${m.material.unit}`).join('\n')||'-'},{title:'Recomendações',body:o.recommendations??'-'}],photos:o.photos.map(p=>({fileUrl:p.fileUrl,caption:p.description??p.category})),signature:o.signatures[0]?{name:o.signatures[0].signerName,fileUrl:o.signatures[0].fileUrl}:null,footer:`${o.company.tradeName} • Relatório técnico Solucenter`});
  try{const d=await prisma.generatedDocument.create({data:{companyId:u.companyId,type:'TECHNICAL_REPORT',entityId:o.id,fileUrl:pdf.fileUrl,publicToken:pdf.token,expiresAt:expiry()}});return {document:dto(d),shareUrl:shareUrl(pdf.token)};}
  catch(e){await deletePrivateDocument(pdf.fileUrl);throw e;}
 });
 app.get('/public/:token',{preHandler:permit('document.read')},async(req,reply)=>{
  const parsed=tokenSchema.safeParse((req.params as any).token);
  if(!parsed.success)return fail(reply,404,'DOCUMENT_NOT_FOUND','Documento indisponível.');
  const u=req.user as AuthUser,d=await prisma.generatedDocument.findFirst({where:{publicToken:parsed.data,companyId:u.companyId}});
  if(!d||d.expiresAt&&d.expiresAt<new Date())return fail(reply,404,'DOCUMENT_NOT_FOUND','Documento indisponível.');
  return dto(d);
 });
}

export async function publicDocumentRoutes(app:FastifyInstance){
 app.get('/:token',async(req,reply)=>{
  const parsed=tokenSchema.safeParse((req.params as any).token);
  if(!parsed.success)return reply.code(404).type('text/html').send('<h1>Documento indisponível</h1>');
  const d=await prisma.generatedDocument.findUnique({where:{publicToken:parsed.data}});
  if(!d||d.expiresAt&&d.expiresAt<new Date())return reply.code(404).type('text/html').send('<h1>Documento indisponível</h1>');
  if(!privateStorageReady())return reply.code(503).type('text/html').send('<h1>Documento temporariamente indisponível</h1>');
  const pdf=await readPrivateDocument(d.fileUrl,d.companyId).catch(()=>null);
  if(!pdf)return reply.code(404).type('text/html').send('<h1>Documento indisponível</h1>');
  return reply.type('application/pdf').header('Content-Disposition','inline; filename="documento-solucenter.pdf"').send(pdf);
 });
}
