'use client';
import {useEffect,useMemo,useState} from 'react';
import {api} from '../../../lib/api';

const isoDate=(d:Date)=>d.toISOString().slice(0,10);
export default function NovoOrcamento(){
 const [customers,setCustomers]=useState<any[]>([]),[customerId,setCustomerId]=useState(''),[units,setUnits]=useState<any[]>([]),[unitId,setUnitId]=useState('');
 const [discount,setDiscount]=useState(0),[validUntil,setValidUntil]=useState(()=>{const d=new Date();d.setDate(d.getDate()+30);return isoDate(d)});
 const [paymentTerms,setPaymentTerms]=useState('Dinheiro, PIX ou cartão de crédito com acréscimo de 10%.'),[warrantyTerms,setWarrantyTerms]=useState('Garantia do serviço: 90 dias.'),[notes,setNotes]=useState('');
 const [items,setItems]=useState<any[]>([{itemType:'SERVICE',description:'',quantity:1,unitPrice:0,unitCost:0}]),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{api('/customers').then(setCustomers)},[]);
 useEffect(()=>{if(customerId)api(`/units/customer/${customerId}`).then(setUnits).catch(()=>setUnits([]));else setUnits([])},[customerId]);
 const t=useMemo(()=>{const subtotal=items.reduce((s,i)=>s+i.quantity*i.unitPrice,0),cost=items.reduce((s,i)=>s+i.quantity*i.unitCost,0),total=Math.max(0,subtotal-discount),profit=total-cost;return {subtotal,cost,total,profit,margin:total?profit/total*100:0}},[items,discount]);
 function patch(i:number,k:string,v:any){setItems(a=>a.map((x,n)=>n===i?{...x,[k]:v}:x))}
 async function save(){
  if(busy)return;setBusy(true);setMsg('');
  try{
   const q:any=await api('/quotes',{method:'POST',body:JSON.stringify({customerId,unitId:unitId||undefined,discount,validUntil,paymentTerms,warrantyTerms,notes:notes||undefined,items})});
   setMsg(`Orçamento ${q.quoteNumber} criado com sucesso.`);
  }catch(e:any){setMsg(e.message)}finally{setBusy(false)}
 }
 return <main className="shell"><h1>Novo orçamento</h1>
  <div className="card form">
   <label>Cliente<select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Selecione</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label>Unidade<select value={unitId} onChange={e=>setUnitId(e.target.value)}><option value="">Selecione</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
   <label>Validade do orçamento<input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label>
  </div>
  <h2>Serviços e materiais</h2>
  {items.map((x,i)=><div className="card form" key={i}>
   <label>Tipo<select value={x.itemType} onChange={e=>patch(i,'itemType',e.target.value)}><option value="SERVICE">Serviço</option><option value="MATERIAL">Material</option><option value="OTHER">Outro</option></select></label>
   <input placeholder="Descrição" value={x.description} onChange={e=>patch(i,'description',e.target.value)}/>
   <input type="number" min="0.001" step="0.001" placeholder="Qtd." value={x.quantity} onChange={e=>patch(i,'quantity',+e.target.value)}/>
   <input type="number" min="0" step="0.01" placeholder="Custo unitário" value={x.unitCost} onChange={e=>patch(i,'unitCost',+e.target.value)}/>
   <input type="number" min="0" step="0.01" placeholder="Venda unitária" value={x.unitPrice} onChange={e=>patch(i,'unitPrice',+e.target.value)}/>
   {items.length>1&&<button type="button" onClick={()=>setItems(a=>a.filter((_,n)=>n!==i))}>Remover item</button>}
  </div>)}
  <button type="button" onClick={()=>setItems(a=>[...a,{itemType:'SERVICE',description:'',quantity:1,unitPrice:0,unitCost:0}])}>+ Item</button>
  <div className="card form">
   <p>Venda: R$ {t.total.toFixed(2)}</p><p>Custo previsto: R$ {t.cost.toFixed(2)}</p><h3>Lucro previsto: R$ {t.profit.toFixed(2)} · {t.margin.toFixed(1)}%</h3>
   <label>Desconto <input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(+e.target.value)}/></label>
   <label>Condições de pagamento<textarea value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)}/></label>
   <label>Garantia<textarea value={warrantyTerms} onChange={e=>setWarrantyTerms(e.target.value)}/></label>
   <label>Observações adicionais<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label>
  </div>
  <button onClick={save} disabled={busy||!customerId}>{busy?'Salvando…':'Salvar orçamento'}</button>{msg&&<p>{msg}</p>}
 </main>
}
