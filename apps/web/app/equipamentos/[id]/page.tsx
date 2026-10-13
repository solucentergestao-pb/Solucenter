"use client";
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {api} from '../../../lib/api';

const statusLabel:Record<string,string>={OPEN:'Aberta',SCHEDULED:'Agendada',ASSIGNED:'Atribuída',ON_THE_WAY:'A caminho',IN_PROGRESS:'Em atendimento',WAITING_APPROVAL:'Aguardando aprovação',WAITING_PARTS:'Aguardando peças',COMPLETED:'Concluída',INVOICED:'Faturada',RECEIVED:'Recebida',CANCELLED:'Cancelada'};

export default function EquipmentDetail(){
 const params=useParams<{id:string}>(),id=Array.isArray(params?.id)?params.id[0]:params?.id;
 const[equipment,setEquipment]=useState<any>(null),[orders,setOrders]=useState<any[]>([]),[error,setError]=useState(''),[downloading,setDownloading]=useState('');
 const[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[form,setForm]=useState<any>(null);
 useEffect(()=>{if(!id)return;Promise.all([api('/equipment'),api('/service-orders')]).then(([eqs,oss]:any)=>{const eq=eqs.find((x:any)=>x.id===id);if(!eq)throw new Error('Equipamento não encontrado.');setEquipment(eq);setForm({equipmentType:eq.equipmentType??"",capacityBtu:eq.capacityBtu??"",technology:eq.technology??"",cycle:eq.cycle??"",voltage:eq.voltage??"",phase:eq.phase??"",refrigerant:eq.refrigerant??"",serialNumber:eq.serialNumber??"",notes:eq.notes??""});setOrders(oss.filter((x:any)=>(x.equipmentId??x.equipment?.id)===id))}).catch((e:any)=>setError(e?.message??'Não foi possível carregar a ficha do equipamento.'))},[id]);
 const history=useMemo(()=>orders.slice().sort((a:any,b:any)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()),[orders]);
 async function saveEquipment(e:any){e.preventDefault();if(!id||!form||busy)return;setBusy(true);setError('');try{await api('/equipment/'+id,{method:'PATCH',body:JSON.stringify({...form,capacityBtu:form.capacityBtu?Number(form.capacityBtu):undefined,voltage:form.voltage?Number(form.voltage):undefined})});setEditing(false);const eqs:any=await api('/equipment');const eq=eqs.find((x:any)=>x.id===id);setEquipment(eq);setForm({equipmentType:eq.equipmentType??"",capacityBtu:eq.capacityBtu??"",technology:eq.technology??"",cycle:eq.cycle??"",voltage:eq.voltage??"",phase:eq.phase??"",refrigerant:eq.refrigerant??"",serialNumber:eq.serialNumber??"",notes:eq.notes??""})}catch(e:any){setError(e?.message??'Não foi possível atualizar o equipamento.')}finally{setBusy(false)}}
 async function archive(){if(!id||busy||!confirm('Arquivar este equipamento? O histórico e o QR serão preservados.'))return;setBusy(true);setError('');try{await api('/equipment/'+id,{method:'DELETE'});window.location.href='/equipamentos'}catch(e:any){setError(e?.message??'Não foi possível arquivar o equipamento.');setBusy(false)}}
 async function download(path:string,filename:string,key:string){setDownloading(key);setError('');try{const blob:any=await api(path);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}catch(e:any){setError(e?.message??'Não foi possível baixar o arquivo.')}finally{setDownloading('')}}
 return <main className="shell"><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h1>{equipment?.assetCode??'Ficha do equipamento'}</h1><p className="muted">Ficha técnica e histórico de serviços.</p></div><Link className="btn secondary" href="/equipamentos">Voltar aos equipamentos</Link></div>
 {error&&<p className="error">{error}</p>}
 {equipment&&<><div className="card">
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
 <button className="btn secondary" disabled={!!downloading} onClick={()=>download(`/equipment/${equipment.id}/qr`,`${equipment.assetCode}.png`,'qr')}>{downloading==='qr'?'Baixando QR…':'Baixar QR Code'}</button>
 <button className="btn secondary" disabled={!!downloading} onClick={()=>download(`/equipment/${equipment.id}/label`,`${equipment.assetCode}-60x40mm.pdf`,'label')}>{downloading==='label'?'Baixando etiqueta…':'Baixar etiqueta 60 × 40 mm'}</button>
 <button className="btn secondary" onClick={()=>setEditing(v=>!v)}>{editing?'Cancelar edição':'Editar equipamento'}</button>
 <button className="btn secondary" disabled={busy} onClick={archive}>Arquivar equipamento</button>
 </div>
 {editing&&form&&<form className="grid" onSubmit={saveEquipment} style={{marginBottom:20}}>
  <input placeholder="Tipo" value={form.equipmentType} onChange={e=>setForm({...form,equipmentType:e.target.value})}/>
  <input placeholder="Capacidade BTU/h" type="number" value={form.capacityBtu} onChange={e=>setForm({...form,capacityBtu:e.target.value})}/>
  <input placeholder="Tecnologia" value={form.technology} onChange={e=>setForm({...form,technology:e.target.value})}/>
  <input placeholder="Ciclo" value={form.cycle} onChange={e=>setForm({...form,cycle:e.target.value})}/>
  <input placeholder="Tensão" type="number" value={form.voltage} onChange={e=>setForm({...form,voltage:e.target.value})}/>
  <input placeholder="Fase" value={form.phase} onChange={e=>setForm({...form,phase:e.target.value})}/>
  <input placeholder="Fluido refrigerante" value={form.refrigerant} onChange={e=>setForm({...form,refrigerant:e.target.value})}/>
  <input placeholder="Número de série" value={form.serialNumber} onChange={e=>setForm({...form,serialNumber:e.target.value})}/>
  <textarea placeholder="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
  <button disabled={busy}>{busy?'Salvando…':'Salvar equipamento'}</button>
 </form>}
 <p><b>Cliente:</b> {equipment.customer?.name}</p><p><b>Unidade:</b> {equipment.unit?.name}</p><p><b>Ambiente:</b> {equipment.environment?.name??'Não informado'}</p>
 <p><b>Tipo:</b> {equipment.equipmentType}</p><p><b>Capacidade:</b> {equipment.capacityBtu?equipment.capacityBtu+' BTU/h':'Não informada'}</p>
 <p><b>Tecnologia:</b> {equipment.technology??'Não informada'}</p><p><b>Fluido:</b> {equipment.refrigerant??'Não informado'}</p><p><b>Tensão:</b> {equipment.voltage?equipment.voltage+' V':'Não informada'}</p><p><b>Número de série:</b> {equipment.serialNumber||'Não informado'}</p>
 </div>
 <div className="sectionTitle"><h2>Histórico técnico</h2></div>
 <div className="card">{history.length===0?<p className="muted">Nenhuma OS vinculada a este equipamento.</p>:history.map((os:any)=><Link key={os.id} href={`/os/${os.id}`} style={{display:'block',padding:'12px 0',borderBottom:'1px solid #eee',color:'inherit',textDecoration:'none'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><b>{os.orderNumber}</b><span>{statusLabel[os.status]??os.status}</span></div><div>{os.reportedProblem}</div>{os.technicalDiagnosis&&<small>Diagnóstico: {os.technicalDiagnosis}</small>}</Link>)}</div></>}
 </main>
}