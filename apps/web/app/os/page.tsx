"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '../../lib/api';

const statusLabel:Record<string,string>={
 OPEN:'Aberta',SCHEDULED:'Agendada',ASSIGNED:'Atribuída',ON_THE_WAY:'A caminho',
 IN_PROGRESS:'Em atendimento',WAITING_APPROVAL:'Aguardando aprovação',
 WAITING_PARTS:'Aguardando peças',COMPLETED:'Concluída',INVOICED:'Faturada',CANCELLED:'Cancelada'
};

export default function OsHistory(){
 const[list,setList]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{api('/service-orders').then((x:any)=>setList(x)).catch((e:any)=>setError(e?.message??'Não foi possível carregar as ordens de serviço.'))},[]);
 return <main className="shell">
  <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
   <div><h1>Ordens de Serviço</h1><p className="muted">Histórico de atendimentos e status das OS.</p></div>
   <Link className="btn" href="/os/nova">+ Nova OS</Link>
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="card">
   {list.length===0&&!error&&<p className="muted">Nenhuma ordem de serviço cadastrada.</p>}
   {list.map((os:any)=><div key={os.id} style={{padding:'14px 0',borderBottom:'1px solid #eee'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'baseline',flexWrap:'wrap'}}>
     <b>{os.orderNumber}</b><span>{statusLabel[os.status]??os.status}</span>
    </div>
    <div>{os.customer?.name??'Cliente não informado'} · {os.unit?.name??'Unidade não informada'}</div>
    <small>{os.equipment?.assetCode?os.equipment.assetCode+' · ':''}{os.reportedProblem}</small>
   </div>)}
  </div>
 </main>
}
