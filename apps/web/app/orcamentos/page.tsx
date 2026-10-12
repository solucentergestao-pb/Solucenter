'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {api} from '../../lib/api';

export default function Orcamentos(){
 const[q,setQ]=useState<any[]>([]),[msg,setMsg]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const load=async()=>{try{setQ(await api('/quotes'));setError('')}catch(e:any){setError(e?.message??'Não foi possível carregar os orçamentos.')}};
 useEffect(()=>{void load()},[]);
 async function pdf(id:string){
  if(busy)return;
  const pdfWindow=window.open('about:blank','_blank');
  if(pdfWindow)pdfWindow.opener=null;
  setBusy(id+':pdf');setMsg('');setError('');
  try{
   const result:any=await api(`/documents/quotes/${id}/pdf`,{method:'POST',body:'{}'});
   if(result?.shareUrl){
    if(pdfWindow)pdfWindow.location.href=result.shareUrl;
    else window.location.href=result.shareUrl;
   }else{
    pdfWindow?.close();
    setMsg('PDF do orçamento gerado.');
   }
  }
  catch(e:any){pdfWindow?.close();setError(e?.message??'Não foi possível gerar o PDF do orçamento.')}
  finally{setBusy('')}
 }
 async function act(id:string,a:string){
  if(busy)return;
  setBusy(id+':'+a);setMsg('');setError('');
  try{
   await api(`/quotes/${id}/${a}`,{method:'POST',body:a==='convert-to-service-order'?JSON.stringify({reportedProblem:'Serviço conforme orçamento aprovado'}):'{}'});
   setMsg(a==='send'?'Orçamento enviado.':a==='approve'?'Orçamento aprovado.':'Orçamento convertido em OS.');
   await load();
  }catch(e:any){setError(e?.message??'Não foi possível concluir esta ação.')}
  finally{setBusy('')}
 }
 return <main className="shell"><h1>Orçamentos</h1><Link href="/orcamentos/novo">+ Novo orçamento</Link>
 {error&&<p className="error" role="alert">{error}</p>}{msg&&<p role="status">{msg}</p>}
 {q.map(x=><div className="card" key={x.id}><b>{x.quoteNumber} · {x.customer.name}</b><p>{x.status} · R$ {Number(x.total).toFixed(2)} · lucro previsto R$ {Number(x.estimatedProfit).toFixed(2)}</p>
 {x.status==='DRAFT'&&<button disabled={!!busy} onClick={()=>act(x.id,'send')}>{busy===x.id+':send'?'Enviando…':'Enviar'}</button>}
 {['SENT','VIEWED'].includes(x.status)&&<button disabled={!!busy} onClick={()=>act(x.id,'approve')}>{busy===x.id+':approve'?'Aprovando…':'Aprovar'}</button>}
 {x.status==='APPROVED'&&!x.convertedAt&&<button disabled={!!busy} onClick={()=>act(x.id,'convert-to-service-order')}>{busy===x.id+':convert-to-service-order'?'Convertendo…':'Converter em OS'}</button>}
 <button disabled={!!busy} onClick={()=>pdf(x.id)}>{busy===x.id+':pdf'?'Gerando PDF…':'Gerar PDF'}</button>
 </div>)}</main>
}