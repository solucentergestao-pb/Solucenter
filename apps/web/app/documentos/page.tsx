'use client';
import {useEffect,useMemo,useState} from 'react';
import {AppShell} from '../../components/AppShell';
import {api} from '../../lib/api';
import {ShareActions} from '../../components/ShareActions';

type Kind='quote'|'os'|'corrective';
const iso=(d:Date)=>d.toISOString().slice(0,10);

export default function Documents(){
 const [kind,setKind]=useState<Kind>('quote'),[id,setId]=useState(''),[quotes,setQuotes]=useState<any[]>([]),[orders,setOrders]=useState<any[]>([]),[customers,setCustomers]=useState<any[]>([]);
 const [customerId,setCustomerId]=useState(''),[startDate,setStartDate]=useState(()=>{const d=new Date();d.setDate(1);return iso(d)}),[endDate,setEndDate]=useState(()=>iso(new Date()));
 const [doc,setDoc]=useState<any>(null),[err,setErr]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 useEffect(()=>{Promise.all([api('/quotes'),api('/service-orders'),api('/customers')]).then(([q,o,c]:any)=>{setQuotes(q);setOrders(o);setCustomers(c)}).catch((e:any)=>setErr(e.message)).finally(()=>setLoading(false))},[]);
 const options=useMemo(()=>kind==='quote'?quotes:orders,[kind,quotes,orders]);
 function changeKind(value:Kind){setKind(value);setId('');setCustomerId('');setDoc(null);setErr('')}
 async function generate(){
  if(busy)return;
  if(kind==='corrective'&&!customerId){setErr('Selecione o cliente.');return}
  if(kind!=='corrective'&&!id){setErr('Selecione o documento.');return}
  setBusy(true);setErr('');setDoc(null);
  try{
   if(kind==='corrective'){
    setDoc(await api('/documents/corrective-maintenance/pdf',{method:'POST',body:JSON.stringify({customerId,startDate,endDate})}));
   }else{
    const path=kind==='quote'?'/documents/quotes/'+id+'/pdf':'/documents/service-orders/'+id+'/pdf';
    setDoc(await api(path,{method:'POST',body:'{}'}));
   }
  }catch(e:any){setErr(e.message)}finally{setBusy(false)}
 }
 const title=kind==='quote'?'Orçamento Solucenter':kind==='os'?'Relatório técnico Solucenter':'Relatório de manutenções corretivas Solucenter';
 return <AppShell><section className="hero"><div><span className="eyebrow">DOCUMENTOS</span><h1>Gerar e compartilhar</h1><p>Orçamentos e relatórios técnicos com identidade Solucenter.</p></div></section><div className="card form">
  <label>Tipo de documento<select value={kind} onChange={e=>changeKind(e.target.value as Kind)}><option value="quote">Orçamento comercial</option><option value="os">OS / relatório técnico individual</option><option value="corrective">Relatório de manutenções corretivas</option></select></label>
  {kind==='corrective'?<>
   <label>Cliente<select value={customerId} disabled={loading} onChange={e=>{setCustomerId(e.target.value);setDoc(null)}}><option value="">{loading?'Carregando…':'Selecione'}</option>{customers.map((x:any)=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
   <label>Início do período<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
   <label>Fim do período<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
  </>:<>
   <label>{kind==='quote'?'Orçamento':'Ordem de serviço'}<select value={id} disabled={loading} onChange={e=>{setId(e.target.value);setDoc(null)}}><option value="">{loading?'Carregando…':'Selecione'}</option>{options.map((x:any)=><option value={x.id} key={x.id}>{kind==='quote'?x.quoteNumber:x.orderNumber} · {x.customer?.name??'Cliente'}</option>)}</select></label>
   {!loading&&!options.length&&<p className="muted">Nenhum registro disponível para gerar este documento.</p>}
  </>}
  <button className="btn primary" onClick={generate} disabled={busy||(kind==='corrective'?!customerId:!id)}>{busy?'Gerando…':'Gerar PDF'}</button>
  {err&&<p className="error" role="alert">{err}</p>}
  {doc?.shareUrl&&<div className="card"><h3>Documento pronto</h3>{kind==='corrective'&&<p className="muted">{doc.count} manutenção(ões) · Total R$ {Number(doc.total??0).toFixed(2)}</p>}<p className="muted">O link seguro expira em {new Date(doc.document.expiresAt).toLocaleDateString('pt-BR')}.</p><ShareActions url={doc.shareUrl} title={title}/></div>}
 </div></AppShell>
}
