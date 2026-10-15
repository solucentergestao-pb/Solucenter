'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {api} from '../../lib/api';

export default function Orcamentos(){
 const router=useRouter();
 const[q,setQ]=useState<any[]>([]),[msg,setMsg]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const[conversion,setConversion]=useState<any>(null),[local,setLocal]=useState<any>(null),[environmentId,setEnvironmentId]=useState(''),[equipmentId,setEquipmentId]=useState('');
 async function prepareConversion(quote:any){
  if(busy)return;setBusy(quote.id+':load');setError('');
  try{const customer:any=await api('/customers/'+quote.customerId);setLocal(customer);setEnvironmentId('');setEquipmentId('');setConversion(quote)}
  catch(e:any){setError(e?.message??'Não foi possível carregar o local do orçamento.')}finally{setBusy('')}
 }
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
    const token=String(result.shareUrl).split('/').filter(Boolean).at(-1);
    const safeUrl=token?`/backend/public/documents/${token}`:result.shareUrl;
    if(pdfWindow)pdfWindow.location.href=safeUrl;
    else window.location.href=safeUrl;
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
   const result:any=await api(`/quotes/${id}/${a}`,{method:'POST',body:a==='convert-to-service-order'?JSON.stringify({reportedProblem:'Serviço conforme orçamento aprovado',environmentId:environmentId||undefined,equipmentId:equipmentId||undefined}):'{}'});
   setMsg(a==='send'?'Orçamento enviado.':a==='approve'?'Orçamento aprovado.':'Orçamento convertido em OS.');
   if(a==='convert-to-service-order'&&result?.id){router.push(`/os/${result.id}`);return}
   await load();
  }catch(e:any){setError(e?.message??'Não foi possível concluir esta ação.')}
  finally{setBusy('')}
 }
 return <main className="shell"><h1>Orçamentos</h1><Link href="/orcamentos/novo">+ Novo orçamento</Link>
 {error&&<p className="error" role="alert">{error}</p>}{msg&&<p role="status">{msg}</p>}
 {q.map(x=><div className="card" key={x.id}><b>{x.quoteNumber} · {x.customer.name}</b><p>{x.status} · R$ {Number(x.total).toFixed(2)} · lucro previsto R$ {Number(x.estimatedProfit).toFixed(2)}</p>
 {x.status==='DRAFT'&&<button disabled={!!busy} onClick={()=>act(x.id,'send')}>{busy===x.id+':send'?'Enviando…':'Enviar'}</button>}
 {['SENT','VIEWED'].includes(x.status)&&<button disabled={!!busy} onClick={()=>act(x.id,'approve')}>{busy===x.id+':approve'?'Aprovando…':'Aprovar'}</button>}
 {x.status==='APPROVED'&&!x.convertedAt&&<button disabled={!!busy} onClick={()=>prepareConversion(x)}>{busy===x.id+':convert-to-service-order'?'Convertendo…':'Converter em OS'}</button>}
 {conversion?.id===x.id&&<form onSubmit={e=>{e.preventDefault();void act(x.id,'convert-to-service-order')}}>
 <h2>Local e equipamento da OS</h2><p>Unidade: {x.unit?.name??'Não informada'}</p>
 {!x.unitId&&<p className="error">O orçamento precisa ter uma unidade antes da conversão.</p>}
 <label className="field">Ambiente<select disabled={!!busy} value={environmentId} onChange={e=>{setEnvironmentId(e.target.value);setEquipmentId('')}}><option value="">Não informado</option>{local?.units?.find((u:any)=>u.id===x.unitId)?.environments?.map((env:any)=><option key={env.id} value={env.id}>{env.name}</option>)}</select></label>
 <label className="field">Equipamento<select disabled={!!busy} value={equipmentId} onChange={e=>{const id=e.target.value;setEquipmentId(id);const eq=local?.equipment?.find((item:any)=>item.id===id);if(eq?.environmentId)setEnvironmentId(eq.environmentId)}}><option value="">Não informado</option>{local?.equipment?.filter((eq:any)=>eq.unitId===x.unitId&&(!environmentId||eq.environmentId===environmentId)).map((eq:any)=><option key={eq.id} value={eq.id}>{eq.assetCode} · {eq.equipmentType}</option>)}</select></label>
 <button type="submit" disabled={!!busy||!x.unitId}>{busy===x.id+':convert-to-service-order'?'Convertendo…':'Confirmar e abrir OS'}</button> <button type="button" disabled={!!busy} onClick={()=>setConversion(null)}>Cancelar</button>
 </form>}
 <button disabled={!!busy} onClick={()=>pdf(x.id)}>{busy===x.id+':pdf'?'Gerando PDF…':'Gerar PDF'}</button>
 </div>)}</main>
}