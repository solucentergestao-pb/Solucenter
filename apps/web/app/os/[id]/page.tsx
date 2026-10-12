"use client";
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {api} from '../../../lib/api';

const statusLabel:Record<string,string>={
 OPEN:'Aberta',SCHEDULED:'Agendada',ASSIGNED:'Atribuída',ON_THE_WAY:'A caminho',
 IN_PROGRESS:'Em atendimento',WAITING_APPROVAL:'Aguardando aprovação',
 WAITING_PARTS:'Aguardando peças',COMPLETED:'Concluída',INVOICED:'Faturada',
 RECEIVED:'Recebida',CANCELLED:'Cancelada'
};
const money=(v:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v??0));

export default function OsDetail(){
 const params=useParams<{id:string}>(),id=Array.isArray(params?.id)?params.id[0]:params?.id;
 const[os,setOs]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[dueDate,setDueDate]=useState(''),[pdfBusy,setPdfBusy]=useState(false),[edit,setEdit]=useState<any>({finalValue:0,laborCost:0,travelCost:0,feesCost:0,otherCost:0});
 useEffect(()=>{if(!id)return;api('/service-orders').then((rows:any[])=>{const found=rows.find(x=>x.id===id);if(!found)throw new Error('OS não encontrada.');setOs(found);setEdit({finalValue:Number(found.finalValue??found.quotedValue??0),laborCost:Number(found.laborCost??0),travelCost:Number(found.travelCost??0),feesCost:Number(found.feesCost??0),otherCost:Number(found.otherCost??0)})}).catch((e:any)=>setError(e?.message??'Não foi possível carregar a OS.')).finally(()=>setLoading(false))},[id]);
 const value=useMemo(()=>Number(os?.finalValue??os?.quotedValue??0),[os]);
 async function startAttendance(){
  setBusy(true);setError('');
  try{await api(`/service-orders/${id}/start`,{method:'POST',body:'{}'});location.href=`/os/${id}/atendimento`}
  catch(e:any){setError(e?.message??'Não foi possível iniciar o atendimento.');setBusy(false)}
 }
 async function saveFinancials(){
  setBusy(true);setError('');setMessage('');
  try{const updated:any=await api(`/service-orders/${id}/financials`,{method:'PATCH',body:JSON.stringify(Object.fromEntries(Object.entries(edit).map(([k,v])=>[k,Number(v)])))});setOs((current:any)=>({...current,...updated}));setMessage('Valores da OS atualizados.');}
  catch(e:any){setError(e?.message??'Não foi possível atualizar os valores da OS.')}
  finally{setBusy(false)}
 }
 async function generatePdf(){
  if(!id||pdfBusy)return;
  // Abra a aba ainda dentro do gesto do clique. Navegadores móveis podem
  // bloquear window.open quando ele é chamado somente após um await.
  const pdfWindow=window.open('about:blank','_blank');
  if(pdfWindow)pdfWindow.opener=null;
  setPdfBusy(true);setError('');setMessage('');
  try{
   const result:any=await api(`/documents/service-orders/${id}/pdf`,{method:'POST',body:'{}'});
   if(result?.shareUrl){
    const token=String(result.shareUrl).split('/').filter(Boolean).at(-1);
    const safeUrl=token?`/backend/public/documents/${token}`:result.shareUrl;
    if(pdfWindow)pdfWindow.location.href=safeUrl;
    else window.location.href=safeUrl;
   }else{
    pdfWindow?.close();
    setMessage('PDF gerado com sucesso.');
   }
  }
  catch(e:any){pdfWindow?.close();setError(e?.message??'Não foi possível gerar o PDF da OS.')}
  finally{setPdfBusy(false)}
 }
 async function invoice(){
  if(!dueDate){setError('Informe o vencimento da cobrança.');return}
  if(value<=0){setError('Esta OS não possui valor para cobrança.');return}
  setBusy(true);setError('');
  try{await api(`/service-orders/${id}/invoice`,{method:'POST',body:JSON.stringify({dueDate})});location.href='/financeiro'}
  catch(e:any){setError(e?.message??'Não foi possível gerar a cobrança.');setBusy(false)}
 }
 return <main className="shell">
  <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
   <div><h1>{os?.orderNumber??'Detalhes da OS'}</h1><p className="muted">Detalhes da ordem de serviço e cobrança.</p></div>
   <Link className="btn secondary" href="/os">Voltar ao histórico</Link>
  </div>
  {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {loading&&<p>Carregando OS…</p>}
  {os&&<div className="card">
   <p><b>Status:</b> {statusLabel[os.status]??os.status}</p>
   <p><b>Cliente:</b> {os.customer?.name??'Não informado'}</p>
   <p><b>Unidade:</b> {os.unit?.name??'Não informada'}</p>
   <p><b>Equipamento:</b> {os.equipment?.assetCode??'Não informado'}</p>
   <p><b>Problema relatado:</b> {os.reportedProblem}</p>
   {os.technicalDiagnosis&&<p><b>Diagnóstico técnico:</b> {os.technicalDiagnosis}</p>}
   {os.performedService&&<p><b>Serviço executado:</b> {os.performedService}</p>}
   {os.recommendations&&<p><b>Recomendações:</b> {os.recommendations}</p>}
   <p><b>Valor final:</b> {money(value)}</p>
   {['COMPLETED','INVOICED','RECEIVED'].includes(os.status)&&<button className="btn secondary" disabled={pdfBusy} onClick={generatePdf}>{pdfBusy?'Gerando PDF…':'Gerar PDF da OS / Relatório técnico'}</button>}
   {['OPEN','SCHEDULED','ASSIGNED','ON_THE_WAY'].includes(os.status)&&<button className="btn" disabled={busy} onClick={startAttendance}>{busy?'Iniciando…':'Iniciar atendimento'}</button>}
   {os.status==='IN_PROGRESS'&&<Link className="btn" href={`/os/${os.id}/atendimento`}>Continuar atendimento</Link>}
   {os.status==='COMPLETED'&&<div className="card" style={{marginTop:16}}>
    <h3>Ajustar valores da OS</h3>
    <div className="row">{[['finalValue','Valor cobrado'],['laborCost','Mão de obra'],['travelCost','Deslocamento'],['feesCost','Taxas'],['otherCost','Outros custos']].map(([k,l])=><div className="field" key={k}>{l}<input className="input" type="number" min="0" step="0.01" value={edit[k]} onChange={e=>setEdit((x:any)=>({...x,[k]:e.target.value}))}/></div>)}</div>
    <button className="btn secondary" disabled={busy} onClick={saveFinancials}>{busy?'Salvando…':'Salvar valores'}</button>
   </div>}
   {os.status==='COMPLETED'&&value>0&&<div>
    <div className="field">Vencimento da cobrança<input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
    <button className="btn" disabled={busy||!dueDate} onClick={invoice}>{busy?'Gerando cobrança…':'Gerar cobrança e abrir Financeiro'}</button>
   </div>}
   {os.status==='COMPLETED'&&value<=0&&<p className="muted">Esta OS foi concluída com valor R$ 0,00. Para gerar cobrança, a OS precisa ter valor final maior que zero.</p>}
   {os.status==='INVOICED'&&<p role="status">Cobrança já gerada para esta OS. Consulte o Financeiro a Receber.</p>}
   {os.status==='RECEIVED'&&<p role="status">Esta OS já foi recebida.</p>}
  </div>}
 </main>
}
