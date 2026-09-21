"use client";
import {useEffect,useState} from 'react';
import {api} from '../../lib/api';

export default function Clientes(){
 const[list,setList]=useState<any[]>([]);
 const[name,setName]=useState('');
 const[type,setType]=useState('PJ');
 const[whatsapp,setWhatsapp]=useState('');
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);

 async function load(){
  try{setList(await api('/customers'));setError('')}
  catch(e:any){setError(e?.message??'Não foi possível carregar os clientes.')}
 }
 useEffect(()=>{load()},[]);

 async function add(e:React.FormEvent){
  e.preventDefault();
  if(busy)return;
  setError('');
  setBusy(true);
  try{
   await api('/customers',{method:'POST',body:JSON.stringify({name:name.trim(),type,whatsapp:whatsapp.trim()})});
   setName('');
   setWhatsapp('');
   await load();
  }catch(e:any){
   setError(e?.message??'Não foi possível salvar o cliente.');
  }finally{
   setBusy(false);
  }
 }

 return <main className="shell">
  <h1>Clientes</h1>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="grid">
   <form className="card" onSubmit={add}>
    <h3>Novo cliente</h3>
    <div className="field">Tipo<select value={type} onChange={e=>setType(e.target.value)}><option>PJ</option><option>PF</option></select></div>
    <div className="field">Nome / Razão Social<input className="input" value={name} onChange={e=>setName(e.target.value)} required minLength={2}/></div>
    <div className="field">WhatsApp<input className="input" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)}/></div>
    <button className="btn" disabled={busy}>{busy?'Salvando…':'Salvar cliente'}</button>
   </form>
   <div className="card">
    <h3>Clientes cadastrados</h3>
    {list.map(c=><div key={c.id} style={{padding:'10px 0',borderBottom:'1px solid #eee'}}><b>{c.name}</b><br/><small>{c.code} · {c.units?.length??0} unidade(s)</small></div>)}
   </div>
  </div>
 </main>
}
