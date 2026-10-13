'use client';
import {useEffect,useState} from 'react';
import {AppShell} from '../../../components/AppShell';
import {api} from '../../../lib/api';
const money=(v:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
export default function Servicos(){
 const [items,setItems]=useState<any[]>([]),[name,setName]=useState(''),[price,setPrice]=useState(0),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[editingId,setEditingId]=useState(''),[edit,setEdit]=useState<any>(null);
 const load=()=>api('/service-orders/service-types').then((x:any)=>setItems(x)).catch((e:any)=>setErr(e.message));
 useEffect(()=>{load()},[]);
 async function add(){if(name.trim().length<2)return;setBusy(true);setErr('');try{await api('/service-orders/service-types',{method:'POST',body:JSON.stringify({name:name.trim(),basePrice:Number(price)})});setName('');setPrice(0);await load()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 async function save(id:string){if(!edit||busy)return;setBusy(true);setErr('');try{await api('/service-orders/service-types/'+id,{method:'PATCH',body:JSON.stringify({name:edit.name.trim(),basePrice:Number(edit.basePrice)})});setEditingId('');setEdit(null);await load()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 async function archive(id:string,name:string){if(!confirm('Excluir '+name+' do catálogo? O histórico das OS será preservado.'))return;setBusy(true);setErr('');try{await api('/service-orders/service-types/'+id,{method:'DELETE'});await load()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 return <AppShell active="servicos"><section className="hero"><div><span className="eyebrow">CATÁLOGO</span><h1>Serviços</h1><p>Serviços reutilizáveis com preço padrão editável por atendimento.</p></div></section>
 <div className="card form"><h2>Novo serviço</h2><label>Nome<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Limpeza de filtros"/></label><label>Preço padrão<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(+e.target.value)}/></label><button className="btn primary" onClick={add} disabled={busy||name.trim().length<2}>{busy?'Salvando…':'+ Novo serviço'}</button>{err&&<p className="error">{err}</p>}</div>
 <div className="sectionTitle"><h2>Lista de serviços</h2></div>
 <div style={{display:'grid',gap:12}}>
 {items.map(x=><div className="card" key={x.id}>
  {editingId===x.id&&edit?<div className="grid">
   <input value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/>
   <input type="number" min="0" step="0.01" value={edit.basePrice} onChange={e=>setEdit({...edit,basePrice:e.target.value})}/>
   <button className="btn primary" disabled={busy} onClick={()=>save(x.id)}>Salvar</button>
   <button className="btn secondary" type="button" onClick={()=>{setEditingId('');setEdit(null)}}>Cancelar</button>
  </div>:<div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',flexWrap:'wrap'}}>
   <div><b>{x.name}</b><p className="muted">Preço padrão: {money(x.basePrice)}</p></div>
   <div style={{display:'flex',gap:8}}><button className="btn secondary" onClick={()=>{setEditingId(x.id);setEdit({name:x.name,basePrice:Number(x.basePrice)})}}>Editar</button><button className="btn secondary" onClick={()=>archive(x.id,x.name)}>Excluir</button></div>
  </div>}
 </div>)}
 </div>
 {!items.length&&!err&&<p className="muted">Nenhum serviço cadastrado.</p>}</AppShell>;
}
