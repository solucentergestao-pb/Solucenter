'use client';
import {useEffect,useMemo,useState} from 'react';
import {AppShell} from '../../components/AppShell';
import {api} from '../../lib/api';
import {ShareActions} from '../../components/ShareActions';

export default function Documents(){
 const [kind,setKind]=useState<'quote'|'os'>('quote'),[id,setId]=useState(''),[quotes,setQuotes]=useState<any[]>([]),[orders,setOrders]=useState<any[]>([]);
 const [doc,setDoc]=useState<any>(null),[err,setErr]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 useEffect(()=>{Promise.all([api('/quotes'),api('/service-orders')]).then(([q,o]:any)=>{setQuotes(q);setOrders(o)}).catch((e:any)=>setErr(e.message)).finally(()=>setLoading(false))},[]);
 const options=useMemo(()=>kind==='quote'?quotes:orders,[kind,quotes,orders]);
 function changeKind(value:'quote'|'os'){setKind(value);setId('');setDoc(null);setErr('')}
 async function generate(){
  if(!id||busy)return;setBusy(true);setErr('');setDoc(null);
  try{const path=kind==='quote'?`/documents/quotes/${id}/pdf`:`/documents/service-orders/${id}/pdf`;setDoc(await api(path,{method:'POST'}))}
  catch(e:any){setErr(e.message)}finally{setBusy(false)}
 }
 return <AppShell><section className="hero"><div><span className="eyebrow">DOCUMENTOS</span><h1>Gerar e compartilhar</h1><p>Orçamentos e relatórios técnicos com identidade Solucenter.</p></div></section><div className="card form">
  <label>Tipo de documento<select value={kind} onChange={e=>changeKind(e.target.value as 'quote'|'os')}><option value="quote">Orçamento comercial</option><option value="os">OS / relatório técnico</option></select></label>
  <label>{kind==='quote'?'Orçamento':'Ordem de serviço'}<select value={id} disabled={loading} onChange={e=>{setId(e.target.value);setDoc(null)}}><option value="">{loading?'Carregando…':'Selecione'}</option>{options.map((x:any)=><option value={x.id} key={x.id}>{kind==='quote'?x.quoteNumber:x.orderNumber} · {x.customer?.name??'Cliente'}</option>)}</select></label>
  {!loading&&!options.length&&<p className="muted">Nenhum registro disponível para gerar este documento.</p>}
  <button className="btn primary" onClick={generate} disabled={!id||busy}>{busy?'Gerando…':'Gerar PDF'}</button>
  {err&&<p className="error" role="alert">{err}</p>}
  {doc?.shareUrl&&<div className="card"><h3>Documento pronto</h3><p className="muted">O link seguro expira em {new Date(doc.document.expiresAt).toLocaleDateString('pt-BR')}.</p><ShareActions url={doc.shareUrl} title={kind==='quote'?'Orçamento Solucenter':'Relatório técnico Solucenter'}/></div>}
 </div></AppShell>
}
