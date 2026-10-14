'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '../../lib/api';

type Receivable={id:string;customer:{name:string};description:string;originalAmount:string|number;openAmount:string|number;status:string};
const methods=[['PIX','PIX'],['CASH','Dinheiro'],['CREDIT_CARD','Cartão de crédito'],['DEBIT_CARD','Cartão de débito'],['TRANSFER','Transferência'],['BOLETO','Boleto'],['OTHER','Outro']];
export default function Financeiro(){
 const[rows,setRows]=useState<Receivable[]>([]);
 const[error,setError]=useState('');
 const[message,setMessage]=useState('');
 const[busy,setBusy]=useState(false);
 const[loading,setLoading]=useState(true);
 const[selected,setSelected]=useState(''),[amountText,setAmountText]=useState(''),[paymentMethod,setPaymentMethod]=useState('PIX');
 const saving=useRef(false);
 async function load(){
  try{setRows(await api('/finance/receivables'))}
  catch(err:any){setError(err?.message??'Não foi possível carregar as cobranças.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 function openPayment(row:Receivable){
  setSelected(row.id);setAmountText(Number(row.openAmount).toFixed(2).replace('.',','));setPaymentMethod('PIX');setError('');setMessage('');
 }
 async function pay(event:React.FormEvent,id:string,open:number){
  event.preventDefault();if(saving.current)return;
  const raw=amountText.trim(),normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
  const amount=Number(normalized);
  setError('');setMessage('');
  if(!/^\d+(?:\.\d{1,2})?$/.test(normalized)||!Number.isFinite(amount)||amount<=0){setError('Informe um valor recebido maior que zero, com no máximo duas casas decimais.');return}
  if(amount>open){setError('O valor recebido não pode ser maior que o saldo em aberto.');return}
  saving.current=true;setBusy(true);
  try{
   await api(`/finance/receivables/${id}/payments`,{method:'POST',body:JSON.stringify({amount,paymentMethod})});
   setSelected('');setMessage('Pagamento registrado.');
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
   {['OPEN','PARTIALLY_PAID','OVERDUE'].includes(x.status)&&(selected===x.id?
    <form onSubmit={event=>pay(event,x.id,Number(x.openAmount))}>
     <label className="field">Valor recebido (R$)<input className="input" inputMode="decimal" value={amountText} disabled={busy} onChange={event=>setAmountText(event.target.value)} required/></label>
     <label className="field">Forma de pagamento<select value={paymentMethod} disabled={busy} onChange={event=>setPaymentMethod(event.target.value)}>{methods.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <button type="submit" disabled={busy}>{busy?'Registrando…':'Confirmar recebimento'}</button>
     <button type="button" disabled={busy} onClick={()=>setSelected('')}>Cancelar</button>
    </form>:
    <button disabled={busy} onClick={()=>openPayment(x)}>Registrar pagamento</button>)}
  </div>)}
 </main>
}
