'use client';
import {useEffect,useState} from 'react';
import {AppShell} from '../../../components/AppShell';
import {api} from '../../../lib/api';
const money=(v:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const empty={sku:'',description:'',category:'',unit:'UN',averageCost:0,salePrice:0,stockQuantity:0,minimumStock:0};
export default function Pecas(){
 const [items,setItems]=useState<any[]>([]),[f,setF]=useState<any>(empty),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[editingId,setEditingId]=useState(''),[edit,setEdit]=useState<any>(null);
 const load=()=>api('/materials').then((x:any)=>setItems(x)).catch((e:any)=>setErr(e.message));
 useEffect(()=>{load()},[]);
 function set(k:string,v:any){setF((x:any)=>({...x,[k]:v}))}
 async function add(){if(!f.sku.trim()||f.description.trim().length<2)return;setBusy(true);setErr('');try{await api('/materials',{method:'POST',body:JSON.stringify({...f,sku:f.sku.trim(),description:f.description.trim(),averageCost:Number(f.averageCost),salePrice:Number(f.salePrice),stockQuantity:Number(f.stockQuantity),minimumStock:Number(f.minimumStock)})});setF(empty);await load()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 async function save(id:string){if(!edit||busy)return;setBusy(true);setErr('');try{await api('/materials/'+id,{method:'PATCH',body:JSON.stringify({...edit,averageCost:Number(edit.averageCost),salePrice:Number(edit.salePrice),stockQuantity:Number(edit.stockQuantity),minimumStock:Number(edit.minimumStock)})});setEditingId('');setEdit(null);await load()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 async function archive(id:string,name:string){if(!confirm('Excluir '+name+' do catálogo? O histórico e movimentações serão preservados.'))return;setBusy(true);setErr('');try{await api('/materials/'+id,{method:'DELETE'});await load()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 return <AppShell active="pecas"><section className="hero"><div><span className="eyebrow">CATÁLOGO</span><h1>Peças e materiais</h1><p>Itens usados em manutenção, orçamento e controle de estoque.</p></div></section>
 <div className="card form"><h2>Novo item</h2><label>Código / SKU<input value={f.sku} onChange={e=>set('sku',e.target.value)} placeholder="Ex.: CAP-60UF"/></label><label>Descrição<input value={f.description} onChange={e=>set('description',e.target.value)} placeholder="Ex.: Capacitor 60 µF"/></label><label>Categoria<input value={f.category} onChange={e=>set('category',e.target.value)} placeholder="Opcional"/></label><label>Unidade<input value={f.unit} onChange={e=>set('unit',e.target.value)} placeholder="UN, M, KG..."/></label><label>Custo<input type="number" min="0" step="0.01" value={f.averageCost} onChange={e=>set('averageCost',+e.target.value)}/></label><label>Preço de venda<input type="number" min="0" step="0.01" value={f.salePrice} onChange={e=>set('salePrice',+e.target.value)}/></label><label>Estoque inicial<input type="number" min="0" step="0.001" value={f.stockQuantity} onChange={e=>set('stockQuantity',+e.target.value)}/></label><button className="btn primary" onClick={add} disabled={busy||!f.sku.trim()||f.description.trim().length<2}>{busy?'Salvando…':'+ Nova peça/material'}</button>{err&&<p className="error">{err}</p>}</div>
 <div className="sectionTitle"><h2>Itens cadastrados</h2></div>
 <div style={{display:'grid',gap:12}}>
 {items.map(x=><div className="card" key={x.id}>
  {editingId===x.id&&edit?<div className="grid">
   <input placeholder="SKU" value={edit.sku} onChange={e=>setEdit({...edit,sku:e.target.value})}/>
   <input placeholder="Descrição" value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/>
   <input placeholder="Categoria" value={edit.category??''} onChange={e=>setEdit({...edit,category:e.target.value})}/>
   <input placeholder="Unidade" value={edit.unit} onChange={e=>setEdit({...edit,unit:e.target.value})}/>
   <input type="number" min="0" step="0.01" placeholder="Custo" value={edit.averageCost} onChange={e=>setEdit({...edit,averageCost:e.target.value})}/>
   <input type="number" min="0" step="0.01" placeholder="Preço de venda" value={edit.salePrice} onChange={e=>setEdit({...edit,salePrice:e.target.value})}/>
   <input type="number" min="0" step="0.001" placeholder="Estoque" value={edit.stockQuantity} onChange={e=>setEdit({...edit,stockQuantity:e.target.value})}/>
   <input type="number" min="0" step="0.001" placeholder="Estoque mínimo" value={edit.minimumStock} onChange={e=>setEdit({...edit,minimumStock:e.target.value})}/>
   <button className="btn primary" disabled={busy} onClick={()=>save(x.id)}>Salvar</button>
   <button className="btn secondary" type="button" onClick={()=>{setEditingId('');setEdit(null)}}>Cancelar</button>
  </div>:<div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',flexWrap:'wrap'}}>
   <div><b>{x.description}</b><p className="muted">{x.sku} · {x.unit} · estoque {Number(x.stockQuantity)} · venda {money(x.salePrice)}</p></div>
   <div style={{display:'flex',gap:8}}><button className="btn secondary" onClick={()=>{setEditingId(x.id);setEdit({sku:x.sku,description:x.description,category:x.category??'',unit:x.unit,averageCost:Number(x.averageCost),salePrice:Number(x.salePrice),stockQuantity:Number(x.stockQuantity),minimumStock:Number(x.minimumStock)})}}>Editar</button><button className="btn secondary" onClick={()=>archive(x.id,x.description)}>Excluir</button></div>
  </div>}
 </div>)}
 </div>
 {!items.length&&!err&&<p className="muted">Nenhuma peça/material cadastrada.</p>}</AppShell>;
}
