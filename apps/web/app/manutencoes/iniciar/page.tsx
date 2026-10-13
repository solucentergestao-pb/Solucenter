'use client';
import {useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {AppShell} from '../../../components/AppShell';
import {api} from '../../../lib/api';

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

export default function IniciarManutencao(){
 const search=useSearchParams();
 const [customers,setCustomers]=useState<any[]>([]),[equipment,setEquipment]=useState<any[]>([]),[services,setServices]=useState<any[]>([]),[materials,setMaterials]=useState<any[]>([]);
 const [customerId,setCustomerId]=useState(''),[equipmentId,setEquipmentId]=useState(search.get('equipmentId')||''),[serviceIds,setServiceIds]=useState<string[]>([]),[materialRows,setMaterialRows]=useState<any[]>([]);
 const [observation,setObservation]=useState(''),[discount,setDiscount]=useState(0),[surcharge,setSurcharge]=useState(0),[reminder,setReminder]=useState(false),[reminderDays,setReminderDays]=useState(90);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[scanMessage,setScanMessage]=useState('');

 useEffect(()=>{Promise.all([api('/customers'),api('/equipment'),api('/service-orders/service-types'),api('/materials')]).then(([c,e,s,m]:any)=>{setCustomers(c);setEquipment(e);setServices(s);setMaterials(m);const preset=search.get('equipmentId');if(preset){const eq=e.find((x:any)=>x.id===preset);if(eq)setCustomerId(eq.customerId??eq.customer?.id??'')}}).catch((e:any)=>setError(e.message))},[]);
 const customerEquipment=useMemo(()=>equipment.filter((e:any)=>!customerId||(e.customerId??e.customer?.id)===customerId),[equipment,customerId]);
 const selectedEquipment=equipment.find((e:any)=>e.id===equipmentId);
 const serviceTotal=serviceIds.reduce((sum,id)=>sum+Number(services.find((s:any)=>s.id===id)?.basePrice??0),0);
 const materialTotal=materialRows.reduce((sum,row)=>{const m=materials.find((x:any)=>x.id===row.materialId);return sum+Number(m?.salePrice??0)*Number(row.quantity||0)},0);
 const total=Math.max(0,serviceTotal+materialTotal+Number(surcharge||0)-Number(discount||0));

 function toggleService(id:string){setServiceIds(x=>x.includes(id)?x.filter(y=>y!==id):[...x,id])}
 function addMaterial(){setMaterialRows(x=>[...x,{materialId:'',quantity:1}])}
 function patchMaterial(i:number,k:string,v:any){setMaterialRows(x=>x.map((r,n)=>n===i?{...r,[k]:v}:r))}
 function chooseEquipment(id:string){setEquipmentId(id);const eq=equipment.find((x:any)=>x.id===id);if(eq)setCustomerId(eq.customerId??eq.customer?.id??'')}

 async function readQr(file:File){
  setError('');setScanMessage('Lendo QR Code…');
  try{
   const Detector=(window as any).BarcodeDetector;
   if(!Detector)throw new Error('Leitura direta não disponível neste navegador. Use a câmera do celular para abrir o QR da etiqueta.');
   const bitmap=await createImageBitmap(file);
   const detector=new Detector({formats:['qr_code']});
   const codes=await detector.detect(bitmap);
   const raw=String(codes?.[0]?.rawValue??'');
   if(!raw)throw new Error('Não consegui identificar um QR Code nessa imagem.');
   const token=raw.includes('/q/')?raw.split('/q/').pop()!.split(/[?#]/)[0]:raw.trim();
   const eq:any=await api('/equipment/by-qr/'+encodeURIComponent(token));
   chooseEquipment(eq.id);setScanMessage('Equipamento identificado: '+eq.assetCode);
  }catch(e:any){setScanMessage('');setError(e?.message??'Não foi possível ler o QR Code.')}
 }

 async function start(){
  if(busy)return;
  if(!selectedEquipment){setError('Selecione um equipamento.');return}
  if(!serviceIds.length){setError('Selecione pelo menos um serviço.');return}
  setBusy(true);setError('');
  try{
   const names=serviceIds.map(id=>services.find((s:any)=>s.id===id)?.name).filter(Boolean);
   const os:any=await api('/service-orders',{method:'POST',body:JSON.stringify({
    customerId:selectedEquipment.customerId??selectedEquipment.customer?.id,
    unitId:selectedEquipment.unitId??selectedEquipment.unit?.id,
    environmentId:selectedEquipment.environmentId??selectedEquipment.environment?.id??undefined,
    equipmentId:selectedEquipment.id,
    serviceTypeId:serviceIds[0],
    priority:'NORMAL',
    reportedProblem:observation.trim()||('Manutenção: '+names.join(', '))
   })});
   await api('/service-orders/'+os.id+'/preparation',{method:'PATCH',body:JSON.stringify({performedService:names.join('; '),quotedValue:total,serviceTypeId:serviceIds[0]})});
   for(const row of materialRows.filter(r=>r.materialId&&Number(r.quantity)>0)){
    await api('/service-orders/'+os.id+'/materials',{method:'POST',body:JSON.stringify({materialId:row.materialId,quantity:Number(row.quantity)})});
   }
   await api('/service-orders/'+os.id+'/start',{method:'POST',body:'{}'});
   if(reminder){
    const date=new Date();date.setDate(date.getDate()+Number(reminderDays||90));
    await api('/operations/maintenance-plans',{method:'POST',body:JSON.stringify({
     customerId:selectedEquipment.customerId??selectedEquipment.customer?.id,
     name:'Retorno '+(selectedEquipment.assetCode||'equipamento'),
     frequency:'CUSTOM',intervalDays:Number(reminderDays||90),startDate:date.toISOString(),
     equipmentIds:[selectedEquipment.id],notes:'Lembrete criado ao iniciar manutenção '+os.orderNumber
    })});
   }
   location.href='/os/'+os.id+'/atendimento';
  }catch(e:any){setError(e?.message??'Não foi possível iniciar a manutenção.');setBusy(false)}
 }

 return <AppShell active="inicio">
  <section className="hero"><div><span className="eyebrow">OPERAÇÃO DE CAMPO</span><h1>Iniciar manutenção</h1><p>Identifique o equipamento, escolha serviços e peças e inicie o atendimento.</p></div></section>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="grid two">
   <section className="card form">
    <h2>1. Equipamento</h2>
    <label>Cliente<select value={customerId} onChange={e=>{setCustomerId(e.target.value);setEquipmentId('')}}><option value="">Selecione</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Equipamento<select value={equipmentId} onChange={e=>chooseEquipment(e.target.value)}><option value="">Selecione</option>{customerEquipment.map((e:any)=><option key={e.id} value={e.id}>{e.assetCode} · {e.equipmentType} · {e.environment?.name??e.unit?.name??''}</option>)}</select></label>
    <label className="btn">Ler QR Code<input style={{display:'none'}} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)void readQr(f)}}/></label>
    {scanMessage&&<p className="muted">{scanMessage}</p>}
    {selectedEquipment&&<div className="portal-item"><b>{selectedEquipment.assetCode}</b><span>{selectedEquipment.customer?.name} · {selectedEquipment.unit?.name} · {selectedEquipment.environment?.name??'Ambiente não informado'}</span></div>}
   </section>

   <section className="card">
    <h2>2. Serviços realizados</h2>
    <div className="portal-list">{services.map((s:any)=><label className="portal-item" key={s.id} style={{cursor:'pointer'}}><span><input type="checkbox" checked={serviceIds.includes(s.id)} onChange={()=>toggleService(s.id)}/> <b>{s.name}</b></span><small>{money(Number(s.basePrice))}</small></label>)}</div>
    {!services.length&&<p className="muted">Nenhum serviço cadastrado.</p>}
   </section>
  </div>

  <section className="card" style={{marginTop:14}}>
   <div className="sectionTitle"><h2>3. Peças substituídas / materiais</h2><button className="btn" type="button" onClick={addMaterial}>+ Adicionar</button></div>
   {materialRows.map((row,i)=><div className="row" key={i} style={{display:'grid',gridTemplateColumns:'1fr 110px 44px',gap:8,marginBottom:8}}>
    <select value={row.materialId} onChange={e=>patchMaterial(i,'materialId',e.target.value)}><option value="">Selecione</option>{materials.map((m:any)=><option key={m.id} value={m.id}>{m.description} · {money(Number(m.salePrice))}</option>)}</select>
    <input type="number" min="0.001" step="0.001" value={row.quantity} onChange={e=>patchMaterial(i,'quantity',e.target.value)}/>
    <button className="btn" type="button" onClick={()=>setMaterialRows(x=>x.filter((_,n)=>n!==i))}>×</button>
   </div>)}
   {!materialRows.length&&<p className="muted">Nenhuma peça adicionada.</p>}
  </section>

  <section className="card form" style={{marginTop:14}}>
   <h2>4. Observações e valores</h2>
   <label>Observação<textarea value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Funcionamento, falha encontrada, comentário do equipamento…"/></label>
   <div className="grid two">
    <label>Desconto<input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(+e.target.value)}/></label>
    <label>Acréscimo<input type="number" min="0" step="0.01" value={surcharge} onChange={e=>setSurcharge(+e.target.value)}/></label>
   </div>
   <label><span><input type="checkbox" checked={reminder} onChange={e=>setReminder(e.target.checked)}/> Marcar lembrete periódico</span></label>
   {reminder&&<label>Próxima manutenção em quantos dias?<input type="number" min="1" value={reminderDays} onChange={e=>setReminderDays(+e.target.value)}/></label>}
  </section>

  <section className="card" style={{marginTop:14}}>
   <h2>Resumo</h2>
   <p>Serviços: <b>{money(serviceTotal)}</b></p><p>Peças/materiais: <b>{money(materialTotal)}</b></p><p>Desconto: <b>- {money(discount)}</b> · Acréscimo: <b>+ {money(surcharge)}</b></p>
   <h3>Total previsto: {money(total)}</h3>
   <button className="btn primary" disabled={busy||!equipmentId||!serviceIds.length} onClick={start}>{busy?'Iniciando…':'Iniciar atendimento'}</button>
  </section>
 </AppShell>;
}
