'use client';
import {useEffect,useState} from 'react';
import {AppShell} from '../../../components/AppShell';
import {api} from '../../../lib/api';
const money=(v:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
export default function Pecas(){
 const [items,setItems]=useState<any[]>([]),[f,setF]=useState<any>({sku:'',description:'',category:'',unit:'UN',averageCost:0,salePrice:0,stockQuantity:0,minimumStock:0}),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>api('/materials').then((x:any)=>setItems(x)).catch((e:any)=>setErr(e.message));
 useEffect(()=>{load()},[]);
 function set(k:string,v:any){setF((x:any)=>({...x,[k]:v}))}
 async function add(){if(!f.sku.trim()||f.description.trim().length<2)return;setBusy(true);setErr('');try{await api('/materials',{method:'POST',body:JSON.stringify({...f,sku:f.sku.trim(),description:f.description.trim(),averageCost:Number(f.averageCost),salePrice:Number(f.salePrice),stockQuantity:Number(f.stockQuantity),minimumStock:Number(f.minimumStock)})});setF({sku:'',description:'',category:'',unit:'UN',averageCost:0,salePrice:0,stockQuantity:0,minimumStock:0});await load()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 return <AppShell active="pecas"><section className="hero"><div><span className="eyebrow">CATÁLOGO</span><h1>Peças e materiais</h1><p>Itens usados em manutenção, orçamento e controle de estoque.</p></div></section>
 <div className="card form"><h2>Novo item</h2><label>Código / SKU<input value={f.sku} onChange={e=>set('sku',e.target.value)} placeholder="Ex.: CAP-60UF"/></label><label>Descrição<input value={f.description} onChange={e=>set('description',e.target.value)} placeholder="Ex.: Capacitor 60 µF"/></label><label>Categoria<input value={f.category} onChange={e=>set('category',e.target.value)} placeholder="Opcional"/></label><label>Unidade<input value={f.unit} onChange={e=>set('unit',e.target.value)} placeholder="UN, M, KG..."/></label><label>Custo<input type="number" min="0" step="0.01" value={f.averageCost} onChange={e=>set('averageCost',+e.target.value)}/></label><label>Preço de venda<input type="number" min="0" step="0.01" value={f.salePrice} onChange={e=>set('salePrice',+e.target.value)}/></label><label>Estoque inicial<input type="number" min="0" step="0.001" value={f.stockQuantity} onChange={e=>set('stockQuantity',+e.target.value)}/></label><button className="btn primary" onClick={add} disabled={busy||!f.sku.trim()||f.description.trim().length<2}>{busy?'Salvando…':'+ Nova peça/material'}</button>{err&&<p className="error">{err}</p>}</div>
 <div className="sectionTitle"><h2>Itens cadastrados</h2></div>{items.map(x=><div className="card" key={x.id}><b>{x.description}</b><p className="muted">{x.sku} · {x.unit} · estoque {Number(x.stockQuantity)} · venda {money(x.salePrice)}</p></div>)}{!items.length&&!err&&<p className="muted">Nenhuma peça/material cadastrada.</p>}</AppShell>;
}
