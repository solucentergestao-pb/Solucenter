'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {AppShell} from '../components/AppShell';
import {api} from '../lib/api';
import {MonthlyChart,Row} from '../components/MonthlyChart';

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

export default function Home(){
 const [d,setD]=useState<any>(null),[rows,setRows]=useState<Row[]>([]),[metric,setMetric]=useState<'revenue'|'profit'|'margin'>('revenue');
 useEffect(()=>{
  if(!localStorage.getItem('token')){location.href='/login';return;}
  Promise.all([api('/dashboard'),api('/dashboard/monthly?months=6')])
   .then(([a,b]:any)=>{setD(a);setRows(b.months)}).catch(()=>{});
 },[]);
 return <AppShell active="inicio">
  <section className="hero">
   <div>
    <span className="eyebrow">SOLUCENTER</span>
    <h1>Climatização & Elétrica</h1>
    <p>Operação de campo, relatórios, orçamentos e gestão em um só lugar.</p>
   </div>
   <span className="liveDot">● Online</span>
  </section>

  <div className="sectionTitle"><div><h2>O que você precisa fazer?</h2><p className="muted">Acesso rápido às rotinas principais.</p></div></div>
  <div className="quick">
   <Link href="/manutencoes/iniciar"><span>▣</span><strong>Iniciar manutenção</strong><small>Ler equipamento ou selecionar cadastro</small></Link>
   <Link href="/documentos"><span>▤</span><strong>Relatórios em PDF</strong><small>Gerar e compartilhar relatórios técnicos</small></Link>
   <Link href="/manutencoes/iniciar?modo=manual"><span>＋</span><strong>Gerar manutenção</strong><small>Criar atendimento sem leitura de QR Code</small></Link>
   <Link href="/orcamentos/novo"><span>R$</span><strong>Orçamentos</strong><small>Serviços, materiais, desconto e valores</small></Link>
  </div>

  <div className="sectionTitle"><h2>Resumo da empresa</h2></div>
  <div className="grid">
   <div className="card metric"><span className="muted">Recebido no mês</span><b>{d?money(d.revenue):'—'}</b></div>
   <div className="card metric"><span className="muted">Custos diretos</span><b>{d?money(d.costs):'—'}</b></div>
   <div className="card metric"><span className="muted">Resultado</span><b>{d?money(d.profit):'—'}</b><small>{d?`${d.margin}% de margem`:''}</small></div>
   <div className="card metric"><span className="muted">A receber</span><b>{d?money(d.receivableOpen):'—'}</b></div>
  </div>

  <div className="sectionTitle"><div><h2>Previsto × realizado</h2><p className="muted">Últimos 6 meses</p></div><div className="segmented">
   <button onClick={()=>setMetric('revenue')} className={metric==='revenue'?'on':''}>Faturamento</button>
   <button onClick={()=>setMetric('profit')} className={metric==='profit'?'on':''}>Lucro</button>
   <button onClick={()=>setMetric('margin')} className={metric==='margin'?'on':''}>Margem</button>
  </div></div>
  <div className="card">{rows.length?<MonthlyChart rows={rows} metric={metric}/>:<p className="muted">Carregando dados do dashboard…</p>}</div>
  <div className="grid two">
   <div className="card"><span className="muted">OS concluídas no mês</span><b className="big">{d?.completedOrders??'—'}</b></div>
   <div className="card"><span className="muted">Orçamentos aguardando decisão</span><b className="big">{d?.pendingQuotes??'—'}</b></div>
  </div>
 </AppShell>;
}
