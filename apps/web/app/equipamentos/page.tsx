"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '../../lib/api';

export default function Equipamentos(){
 const[list,setList]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{api('/equipment').then(setList).catch((e:any)=>setError(e?.message??'Não foi possível carregar os equipamentos.'))},[]);
 return <main className="shell"><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h1>Equipamentos</h1><p className="muted">Ficha técnica e histórico por equipamento.</p></div><Link className="btn" href="/equipamentos/novo">+ Novo equipamento</Link></div>
 {error&&<p className="error">{error}</p>}
 <div className="grid">{list.map((e:any)=><Link href={`/equipamentos/${e.id}`} style={{color:'inherit',textDecoration:'none'}} className="card" key={e.id}><b>{e.assetCode}</b><h3>{e.equipmentType} · {e.capacityBtu??'-'} BTU/h</h3><p>{e.customer.name}<br/>{e.unit.name}{e.environment?' · '+e.environment.name:''}</p><span className="muted">Abrir ficha e histórico</span></Link>)}</div>
 </main>
}