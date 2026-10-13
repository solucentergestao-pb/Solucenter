"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {api} from '../../../../lib/api';
import OsPhotoUpload from '../../../../components/OsPhotoUpload';

export default function AtendimentoOS(){
 const params=useParams<{id:string}>(),id=Array.isArray(params?.id)?params.id[0]:params?.id;
 const[os,setOs]=useState<any>(null),[materials,setMaterials]=useState<any[]>([]),[step,setStep]=useState(1),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const[f,setF]=useState<any>({measurements:{},materialId:'',materialQty:1,technicalDiagnosis:'',performedService:'',recommendations:'',finalValue:0,laborCost:0,travelCost:0,feesCost:0,otherCost:0});
 useEffect(()=>{if(!id)return;Promise.all([api('/service-orders'),api('/materials')]).then(([orders,m]:any)=>{const found=orders.find((x:any)=>x.id===id);if(!found)throw new Error('OS não encontrada.');setOs(found);setMaterials(m);setF((x:any)=>({...x,finalValue:Number(found.finalValue??found.quotedValue??0),performedService:found.performedService??''}))}).catch((e:any)=>setError(e?.message??'Não foi possível carregar o atendimento.'))},[id]);
 function set(k:string,v:any){setF((x:any)=>({...x,[k]:v}))}
 async function saveTech(){if(busy)return;setBusy(true);setError('');try{
  if(Object.values(f.measurements).some(v=>v!==''&&v!=null))await api(`/service-orders/${id}/measurements`,{method:'POST',body:JSON.stringify(Object.fromEntries(Object.entries(f.measurements).filter(([_,v])=>v!==''&&v!=null).map(([k,v])=>[k,Number(v)])))});
  if(f.materialId)await api(`/service-orders/${id}/materials`,{method:'POST',body:JSON.stringify({materialId:f.materialId,quantity:Number(f.materialQty)})});
  setStep(2);
 }catch(e:any){setError(e?.message??'Não foi possível salvar o atendimento.')}finally{setBusy(false)}}
 async function complete(){if(busy)return;setBusy(true);setError('');try{
  await api(`/service-orders/${id}/complete`,{method:'POST',body:JSON.stringify({technicalDiagnosis:f.technicalDiagnosis,performedService:f.performedService,recommendations:f.recommendations,finalValue:Number(f.finalValue),laborCost:Number(f.laborCost),travelCost:Number(f.travelCost),feesCost:Number(f.feesCost),otherCost:Number(f.otherCost)})});
  location.href=`/os/${id}`;
 }catch(e:any){setError(e?.message??'Não foi possível concluir a OS.');setBusy(false)}}
 if(!os)return <main className="shell"><h1>Atendimento</h1>{error?<p className="error">{error}</p>:<p>Carregando…</p>}</main>;
 return <main className="shell"><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h1>{os.orderNumber} · Atendimento</h1><p className="muted">{os.customer?.name} · {os.unit?.name}</p></div><Link className="btn secondary" href={`/os/${id}`}>Voltar</Link></div>{error&&<p className="error" role="alert">{error}</p>}
 {step===1&&<div className="card"><h2>Atendimento técnico</h2><div className="row">{[['voltage','Tensão (V)'],['current','Corrente (A)'],['returnTemperature','Temp. retorno °C'],['supplyTemperature','Temp. insuflamento °C']].map(([k,l])=><div className="field" key={k}>{l}<input className="input" type="number" onChange={e=>setF((x:any)=>({...x,measurements:{...x.measurements,[k]:e.target.value}}))}/></div>)}</div><h3>Material utilizado</h3><div className="row"><select value={f.materialId} onChange={e=>set('materialId',e.target.value)}><option value="">Nenhum</option>{materials.map((m:any)=><option key={m.id} value={m.id}>{m.description} · estoque {m.stockQuantity}</option>)}</select><input className="input" type="number" min="0.001" step="0.001" value={f.materialQty} onChange={e=>set('materialQty',e.target.value)}/></div><OsPhotoUpload osId={id}/><button className="btn" disabled={busy} onClick={saveTech}>{busy?'Salvando…':'Salvar atendimento e finalizar'}</button></div>}
 {step===2&&<div className="card"><h2>Finalização</h2><div className="field">Diagnóstico técnico<textarea required minLength={3} value={f.technicalDiagnosis} onChange={e=>set('technicalDiagnosis',e.target.value)}/></div><div className="field">Serviço executado<textarea required minLength={3} value={f.performedService} onChange={e=>set('performedService',e.target.value)}/></div><div className="field">Recomendações<textarea value={f.recommendations} onChange={e=>set('recommendations',e.target.value)}/></div><div className="row">{[['finalValue','Valor cobrado'],['laborCost','Mão de obra'],['travelCost','Deslocamento'],['feesCost','Taxas'],['otherCost','Outros custos']].map(([k,l])=><div className="field" key={k}>{l}<input className="input" type="number" min="0" step="0.01" value={f[k]} onChange={e=>set(k,e.target.value)}/></div>)}</div><button className="btn" disabled={busy||f.technicalDiagnosis.trim().length<3||f.performedService.trim().length<3} onClick={complete}>{busy?'Concluindo…':'Concluir OS'}</button></div>}
 </main>
}