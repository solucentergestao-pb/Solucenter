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
  const q=await prisma.quote.findFirst({where:{id,companyId:u.companyId},include:{customer:true,unit:true,items:true,company:{include:{settings:true}},createdBy:true}});
  if(!q)return fail(reply,404,'QUOTE_NOT_FOUND','Orçamento não encontrado.');
  const services=q.items.filter(i=>i.itemType==='SERVICE');
  const materials=q.items.filter(i=>i.itemType==='MATERIAL');
  const others=q.items.filter(i=>!['SERVICE','MATERIAL'].includes(i.itemType));
  const customerAddress=q.unit?[q.unit.street,q.unit.number,q.unit.neighborhood,q.unit.city,q.unit.state].filter(Boolean).join(', '):'-';
  const settings=q.company.settings;
  const pdf=await createBusinessPdf({
   companyId:u.companyId,title:'ORÇAMENTO | SOLUCENTER CLIMATIZAÇÃO E ELÉTRICA',number:q.quoteNumber,
   company:q.company.tradeName,logoUrl:settings?.logoUrl??q.company.logoUrl,accent:settings?.primaryColor,
   customer:q.customer.name,
   lines:[
    {label:'CPF / CNPJ',value:q.customer.cpfCnpj??'-'},
    {label:'Telefone',value:q.customer.phone??q.customer.whatsapp??'-'},
    {label:'Endereço',value:customerAddress},
    {label:'Data de envio',value:q.createdAt.toLocaleDateString('pt-BR')},
    {label:'Técnico responsável',value:q.createdBy.name},
    {label:'Contato',value:q.createdBy.phone??settings?.phone??q.company.phone??'(83) 98791-5064'},
    {label:'Validade',value:q.validUntil?.toLocaleDateString('pt-BR')??'-'},
    {label:'Subtotal',value:money(q.subtotal)},{label:'Desconto',value:money(q.discount)},{label:'VALOR TOTAL',value:money(q.total)}
   ],
   sections:[
    {title:'SERVIÇOS',body:services.map(i=>`${i.description}\nQuantidade: ${i.quantity} | Valor unitário: ${money(i.unitPrice)} | Subtotal: ${money(Number(i.quantity)*Number(i.unitPrice))}`).join('\n\n')||'Nenhum serviço incluído.'},
    {title:'MATERIAIS',body:materials.map(i=>`${i.description}\nQuantidade: ${i.quantity} | Valor unitário: ${money(i.unitPrice)} | Subtotal: ${money(Number(i.quantity)*Number(i.unitPrice))}`).join('\n\n')||'Nenhum material incluído.'},
    ...(others.length?[{title:'OUTROS ITENS',body:others.map(i=>`${i.description}\nQuantidade: ${i.quantity} | Valor unitário: ${money(i.unitPrice)}`).join('\n\n')}]:[]),
    {title:'INFORMAÇÕES ADICIONAIS',body:[
      q.validUntil?`Este orçamento tem validade até ${q.validUntil.toLocaleDateString('pt-BR')}.`:'Este orçamento tem validade de 30 dias a contar da data de geração.',
      q.warrantyTerms??settings?.warrantyTerms??'Garantia do serviço: 90 dias.',
      q.paymentTerms??settings?.commercialTerms??'Condições de pagamento: Dinheiro, PIX ou cartão de crédito com acréscimo de 10%.',
      'Não cobramos pagamento antecipado, apenas será cobrado ao término do serviço.',
      q.notes
    ].filter(Boolean).join('\n')}
   ],
   footer:`${q.company.tradeName} • Rua Monteiro Lobato, 677, Laurintzen • CEP 58401-417 • Campina Grande-PB • CNPJ: ${settings?.cnpj??q.company.cnpj??'48.898.362/0001-78'}`
  });
  try{const d=await prisma.generatedDocument.create({data:{companyId:u.companyId,type:'QUOTE',entityId:q.id,fileUrl:pdf.fileUrl,publicToken:pdf.token,expiresAt:expiry()}});return {document:dto(d),shareUrl:shareUrl(pdf.token)};}
  catch(e){await deletePrivateDocument(pdf.fileUrl);throw e;}
 });
 app.post('/service-orders/:id/pdf',{preHandler:permit('document.write')},async(req,reply)=>{
  if(!privateStorageReady())return fail(reply,503,'PRIVATE_STORAGE_UNAVAILABLE','Armazenamento privado não configurado.');
  const u=req.user as AuthUser,{id}=req.params as {id:string};
  const o=await prisma.serviceOrder.findFirst({where:{id,companyId:u.companyId},include:{customer:true,equipment:true,materials:{include:{material:true}},company:true,photos:true,signatures:{orderBy:{signedAt:'desc'},take:1},measurements:true}});
  if(!o)return fail(reply,404,'ORDER_NOT_FOUND','OS não encontrada.');
  const last=o.measurements.at(-1);
  const statusPt:Record<string,string>={DRAFT:'Rascunho',OPEN:'Aberta',SCHEDULED:'Agendada',ASSIGNED:'Atribuída',ON_THE_WAY:'Em deslocamento',IN_PROGRESS:'Em atendimento',WAITING_APPROVAL:'Aguardando aprovação',WAITING_PARTS:'Aguardando peças',COMPLETED:'Concluída',INVOICED:'Faturada',RECEIVED:'Recebida',CANCELLED:'Cancelada'};
  const measurementLines:string[]=[];
  if(last?.voltage!=null)measurementLines.push(`Tensão: ${last.voltage} V`);
  if(last?.current!=null)measurementLines.push(`Corrente: ${last.current} A`);
  if(last?.returnTemperature!=null)measurementLines.push(`Temperatura de retorno: ${last.returnTemperature} C`);
  if(last?.supplyTemperature!=null)measurementLines.push(`Temperatura de insuflamento: ${last.supplyTemperature} C`);
  if(last?.deltaT!=null)measurementLines.push(`Delta T: ${last.deltaT} C`);
  if(last?.lowPressure!=null)measurementLines.push(`Pressão de baixa: ${last.lowPressure}`);
  if(last?.highPressure!=null)measurementLines.push(`Pressão de alta: ${last.highPressure}`);
  const pdf=await createBusinessPdf({companyId:u.companyId,title:'ORDEM DE SERVIÇO / RELATÓRIO TÉCNICO',number:o.orderNumber,company:o.company.tradeName,logoUrl:o.company.logoUrl,customer:o.customer.name,lines:[{label:'Equipamento',value:o.equipment?.assetCode??'-'},{label:'Status',value:statusPt[o.status]??o.status},{label:'Valor do serviço',value:money(o.finalValue)}],sections:[...(measurementLines.length?[{title:'Medições técnicas',body:measurementLines.join('\n')}]:[]),{title:'Problema relatado',body:o.reportedProblem},{title:'Diagnóstico técnico',body:o.technicalDiagnosis??'-'},{title:'Serviço executado',body:o.performedService??'-'},{title:'Materiais utilizados',body:o.materials.map(m=>`${m.material.description}: ${m.quantity} ${m.material.unit}`).join('\n')||'-'},{title:'Recomendações',body:o.recommendations??'-'}],photos:o.photos.map(p=>({fileUrl:p.fileUrl,caption:p.description??p.category})),signature:o.signatures[0]?{name:o.signatures[0].signerName,fileUrl:o.signatures[0].fileUrl}:null,footer:`${o.company.tradeName} • Relatório técnico Solucenter`});
  try{const d=await prisma.generatedDocument.create({data:{companyId:u.companyId,type:'TECHNICAL_REPORT',entityId:o.id,fileUrl:pdf.fileUrl,publicToken:pdf.token,expiresAt:expiry()}});return {document:dto(d),shareUrl:shareUrl(pdf.token)};}
  catch(e){await deletePrivateDocument(pdf.fileUrl);throw e;}
 });
 app.post('/corrective-maintenance/pdf',{preHandler:permit('document.write')},async(req,reply)=>{
  if(!privateStorageReady())return fail(reply,503,'PRIVATE_STORAGE_UNAVAILABLE','Armazenamento privado não configurado.');
  const u=req.user as AuthUser;
  const parsed=z.object({customerId:z.string().uuid(),startDate:z.coerce.date(),endDate:z.coerce.date()}).safeParse(req.body);
  if(!parsed.success)return fail(reply,422,'VALIDATION_ERROR','Informe cliente e período válidos.');
  const {customerId,startDate,endDate}=parsed.data;
  if(endDate<startDate)return fail(reply,422,'VALIDATION_ERROR','A data final deve ser igual ou posterior à inicial.');
  const customer=await prisma.customer.findFirst({where:{id:customerId,companyId:u.companyId},include:{units:true,company:{include:{settings:true}}}});
  if(!customer)return fail(reply,404,'CUSTOMER_NOT_FOUND','Cliente não encontrado.');
  const orders=await prisma.serviceOrder.findMany({
   where:{companyId:u.companyId,customerId,status:{in:['COMPLETED','INVOICED','RECEIVED']},completedAt:{gte:startDate,lte:new Date(endDate.getTime()+86_399_999)}},
   include:{equipment:{include:{environment:true,model:{include:{manufacturer:true}}}},unit:true,materials:{include:{material:true}},serviceType:true},
   orderBy:{completedAt:'desc'}
  });
  if(!orders.length)return fail(reply,404,'NO_CORRECTIVE_MAINTENANCE','Nenhuma manutenção corretiva concluída foi encontrada nesse período.');
  const primaryUnit=customer.units[0];
  const address=primaryUnit?[primaryUnit.street,primaryUnit.number,primaryUnit.neighborhood,primaryUnit.city,primaryUnit.state].filter(Boolean).join(', '):'-';
  const settings=customer.company.settings;
  const blocks=orders.map(o=>{
   const equipment=o.equipment;
   const brandModel=equipment?.model?`${equipment.model.manufacturer.name} - ${equipment.model.name}`:'-';
   const location=[o.unit?.name,equipment?.environment?.name].filter(Boolean).join(' | ');
   const services=o.performedService??o.serviceType?.name??o.reportedProblem;
   const pieces=o.materials.map(m=>`${m.material.description}: ${m.quantity} ${m.material.unit}`).join('; ')||'Nenhuma peça trocada';
   return {
    title:`${o.orderNumber} • ${equipment?.assetCode??'Equipamento não informado'}`,
    body:[
     `Local: ${location||'-'}`,`Marca/Modelo: ${brandModel}`,
     `Serviços realizados: ${services||'-'}`,
     o.technicalDiagnosis?`Diagnóstico: ${o.technicalDiagnosis}`:null,
     `Peças trocadas: ${pieces}`,
     `Data do serviço: ${o.completedAt?.toLocaleDateString('pt-BR')??'-'} | Valor: ${money(o.finalValue??o.quotedValue)}`
    ].filter(Boolean).join('\n')
   };
  });
  const total=orders.reduce((sum,o)=>sum+Number(o.finalValue??o.quotedValue??0),0);
  blocks.push({title:'TOTAL DOS SERVIÇOS',body:money(total)});
  blocks.push({title:'ASSINATURAS',body:'________________________________          ________________________________\nAssinatura do Técnico                              Assinatura do Cliente'});
  const pdf=await createBusinessPdf({
   companyId:u.companyId,title:'RELATÓRIO DE MANUTENÇÕES CORRETIVAS',
   number:`${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`,
   company:customer.company.tradeName,logoUrl:settings?.logoUrl??customer.company.logoUrl,accent:settings?.primaryColor,
   customer:customer.name,
   lines:[{label:'Endereço',value:address},{label:'Telefone',value:customer.phone??customer.whatsapp??'-'},{label:'CPF / CNPJ',value:customer.cpfCnpj??'-'}],
   sections:blocks,
   footer:`${customer.company.tradeName} • Rua Monteiro Lobato, 677, Laurintzen • CEP 58401-417 • Campina Grande-PB • CNPJ: ${settings?.cnpj??customer.company.cnpj??'48.898.362/0001-78'}`
  });
  try{const d=await prisma.generatedDocument.create({data:{companyId:u.companyId,type:'TECHNICAL_REPORT',entityId:customer.id,fileUrl:pdf.fileUrl,publicToken:pdf.token,expiresAt:expiry()}});return {document:dto(d),shareUrl:shareUrl(pdf.token),count:orders.length,total};}
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
