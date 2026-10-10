'use client';
import {useEffect,useMemo,useState} from 'react';
import {AppShell} from '../../../components/AppShell';
import {api} from '../../../lib/api';

type DreData={revenue:number;directCosts:number;grossProfit:number;operatingExpenses:number;operatingResult:number;margin:number;groups:{group:string;amount:number}[]};
type Variance={orderNumber:string;plannedRevenue:number;actualRevenue:number;plannedProfit:number;actualProfit:number};
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const dateValue=(date:Date)=>date.toISOString().slice(0,10);

export default function Dre(){
 const defaults=useMemo(()=>{const now=new Date(),from=new Date(now.getFullYear(),now.getMonth(),1);return {from:dateValue(from),to:dateValue(now)}},[]);
 const[from,setFrom]=useState(defaults.from);const[to,setTo]=useState(defaults.to);
 const[data,setData]=useState<DreData|null>(null);const[variance,setVariance]=useState<Variance[]>([]);
 const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const[d,v]=await Promise.all([api(`/management-finance/dre?from=${from}&to=${to}`),api('/management-finance/planned-vs-actual')]);setData(d);setVariance(v)}catch(err:any){setError(err?.message??'Não foi possível carregar o resultado gerencial.')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 return <AppShell active="financeiro"><section className="hero"><h1>DRE Gerencial</h1><p>Receitas recebidas, custos das OS concluídas e despesas por competência.</p></section>
  <div className="card formGrid" style={{marginTop:16}}><div className="field"><label>Data inicial</label><input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></div><div className="field"><label>Data final</label><input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></div><button className="btn btnPrimary" disabled={loading||!from||!to||from>to} onClick={()=>void load()}>{loading?'Atualizando…':'Atualizar período'}</button></div>
  {error&&<p className="error" role="alert">{error}</p>}{loading&&!data&&<p>Carregando resultado…</p>}
  {data&&<><div className="grid"><div className="card metric"><span className="muted">Receita recebida</span><b>{money.format(data.revenue)}</b></div><div className="card metric"><span className="muted">Lucro bruto</span><b>{money.format(data.grossProfit)}</b></div><div className="card metric"><span className="muted">Despesas</span><b>{money.format(data.operatingExpenses)}</b></div><div className="card metric"><span className="muted">Resultado · {data.margin.toFixed(2)}%</span><b>{money.format(data.operatingResult)}</b></div></div>
   <div className="card tableWrap"><table className="table"><tbody><tr><td>Receita de serviços recebida</td><td>{money.format(data.revenue)}</td></tr><tr><td>(−) Custos diretos das OS</td><td>{money.format(data.directCosts)}</td></tr><tr><td><b>Lucro bruto</b></td><td><b>{money.format(data.grossProfit)}</b></td></tr><tr><td>(−) Despesas operacionais</td><td>{money.format(data.operatingExpenses)}</td></tr>{data.groups.map(x=><tr key={x.group}><td className="muted">↳ {x.group}</td><td>{money.format(x.amount)}</td></tr>)}<tr><td><b>Resultado operacional</b></td><td><b>{money.format(data.operatingResult)}</b></td></tr></tbody></table></div>
   <div className="sectionTitle"><h2>Planejado x realizado por OS</h2></div><div className="card tableWrap"><table className="table"><thead><tr><th>OS</th><th>Receita planejada</th><th>Receita realizada</th><th>Lucro planejado</th><th>Lucro realizado</th></tr></thead><tbody>{variance.map(x=><tr key={x.orderNumber}><td>{x.orderNumber}</td><td>{money.format(x.plannedRevenue)}</td><td>{money.format(x.actualRevenue)}</td><td>{money.format(x.plannedProfit)}</td><td>{money.format(x.actualProfit)}</td></tr>)}{!variance.length&&<tr><td colSpan={5}>Nenhuma OS originada de orçamento para comparar.</td></tr>}</tbody></table></div></>}
 </AppShell>
}
