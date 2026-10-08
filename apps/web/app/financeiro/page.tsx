'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '../../lib/api';

type Receivable={id:string;customer:{name:string};description:string;originalAmount:string|number;openAmount:string|number;status:string};
export default function Financeiro(){
 const[rows,setRows]=useState<Receivable[]>([]);
 const[error,setError]=useState('');
 const[message,setMessage]=useState('');
 const[busy,setBusy]=useState(false);
 const[loading,setLoading]=useState(true);
 const saving=useRef(false);
 async function load(){
  try{setRows(await api('/finance/receivables'))}
  catch(err:any){setError(err?.message??'Não foi possível carregar as cobranças.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 async function pay(id:string,open:number){
  if(saving.current)return;
  const raw=prompt(`Valor recebido (saldo R$ ${open.toFixed(2)}):`);
  if(!raw?.trim())return;
  const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
  const amount=Number(normalized.trim());
  setError('');setMessage('');
  if(!Number.isFinite(amount)||amount<=0){setError('Informe um valor recebido maior que zero.');return}
  saving.current=true;setBusy(true);
  try{
   await api(`/finance/receivables/${id}/payments`,{method:'POST',body:JSON.stringify({amount,paymentMethod:'PIX'})});
   setMessage('Pagamento registrado.');
  }catch(err:any){setError(err?.message??'Não foi possível registrar o pagamento.')}
  finally{await load();saving.current=false;setBusy(false)}
 }
 return <main className="shell">
  <h1>Financeiro · A receber</h1>
  {error&&<p className="error" role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {loading&&<p>Carregando cobranças…</p>}
  {!loading&&!rows.length&&!error&&<p>Nenhuma cobrança cadastrada.</p>}
  {rows.map(x=><div className="card" key={x.id}>
   <b>{x.customer.name}</b><p>{x.description}</p>
   <p>Original R$ {Number(x.originalAmount).toFixed(2)} · Saldo R$ {Number(x.openAmount).toFixed(2)} · {x.status}</p>
   {['OPEN','PARTIALLY_PAID','OVERDUE'].includes(x.status)&&<button disabled={busy} onClick={()=>pay(x.id,Number(x.openAmount))}>{busy?'Registrando…':'Registrar pagamento'}</button>}
  </div>)}
 </main>
}
