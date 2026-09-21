import PDFDocument from 'pdfkit';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
export type PdfLine={label:string,value:string};
export type PdfPhoto={fileUrl:string,caption?:string};
const localPath=(url?:string|null)=>{if(!url)return null; const clean=url.replace(/^\//,''); const p=path.resolve(clean); return fs.existsSync(p)?p:null};
export async function createBusinessPdf(opts:{title:string,number:string,company:string,customer:string,logoUrl?:string|null,accent?:string,lines:PdfLine[],sections?:{title:string,body:string}[],photos?:PdfPhoto[],signature?:{name:string,fileUrl:string}|null,footer?:string}){
 const dir=path.resolve('uploads/documents'); fs.mkdirSync(dir,{recursive:true}); const token=crypto.randomBytes(24).toString('hex'); const file=`${token}.pdf`; const full=path.join(dir,file); const blue=opts.accent??'#075EAC';
 await new Promise<void>((resolve,reject)=>{const doc=new PDFDocument({size:'A4',margin:48,bufferPages:true}); const out=fs.createWriteStream(full); doc.pipe(out);
  const logo=localPath(opts.logoUrl); if(logo){try{doc.image(logo,48,40,{fit:[86,46]})}catch{}}
  doc.fillColor(blue).fontSize(20).text(opts.company,logo?148:48,45); doc.fillColor('#4b5563').fontSize(9).text('Climatização & Elétrica',logo?148:48,70); doc.moveTo(48,96).lineTo(547,96).strokeColor(blue).lineWidth(2).stroke();
  doc.moveDown(3); doc.fillColor('#111827').fontSize(18).text(opts.title); doc.fillColor('#6b7280').fontSize(10).text(`Nº ${opts.number}`); doc.moveDown(); doc.fillColor('#111827').fontSize(11).text(`Cliente: ${opts.customer}`); doc.moveDown(.5);
  for(const l of opts.lines){doc.fillColor('#374151').fontSize(9).text(l.label,{continued:true});doc.fillColor('#111827').fontSize(10).text(`  ${l.value}`)}
  for(const s of opts.sections??[]){doc.moveDown();doc.fillColor(blue).fontSize(12).text(s.title);doc.fillColor('#374151').fontSize(9.5).text(s.body||'-',{lineGap:2})}
  if(opts.photos?.length){doc.addPage();doc.fillColor(blue).fontSize(15).text('Registro fotográfico');doc.moveDown();let x=48,y=90;for(const p of opts.photos.slice(0,6)){const fp=localPath(p.fileUrl);if(!fp)continue;try{doc.image(fp,x,y,{fit:[235,155],align:'center',valign:'center'});doc.fillColor('#4b5563').fontSize(8).text(p.caption??'Foto do atendimento',x,y+160,{width:235});x=x===48?312:48;if(x===48)y+=195;if(y>650){doc.addPage();y=70}}catch{}}}
  if(opts.signature){const sig=localPath(opts.signature.fileUrl);if(doc.y>650)doc.addPage();doc.moveDown(2);doc.fillColor(blue).fontSize(12).text('Aceite / assinatura');if(sig){try{doc.image(sig,48,doc.y+8,{fit:[180,70]});doc.moveDown(6)}catch{}}doc.fillColor('#111827').fontSize(9).text(opts.signature.name)}
  const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.fillColor('#9ca3af').fontSize(8).text(opts.footer??'Documento gerado pelo Solucenter.',48,790,{width:499,align:'center'});doc.text(`Página ${i+1} de ${pages.count}`,48,803,{width:499,align:'center'})}
  doc.end(); out.on('finish',resolve); out.on('error',reject)});
 return {token,fileUrl:`/uploads/documents/${file}`};
}
