"use client";
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {api} from '../../lib/api';

const initial={type:'PJ',name:'',legalName:'',tradeName:'',cpfCnpj:'',phone:'',whatsapp:'',email:'',notes:'',firstUnit:{name:'Matriz',cep:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:'PB',reference:''}};
export default function Clientes(){
 const router=useRouter();
 const[list,setList]=useState<any[]>([]),[form,setForm]=useState(initial),[error,setError]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
 async function load(){try{setList(await api('/customers'));setError('')}catch(e:any){setError(e?.message??'Não foi possível carregar os clientes.')}}
 useEffect(()=>{load()},[]);
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return list;return list.filter(c=>[c.name,c.tradeName,c.phone,c.whatsapp,c.cpfCnpj,c.code].some((v:any)=>String(v??'').toLowerCase().includes(q)))},[list,search]);
 function customer(name:string,value:string){setForm(current=>({...current,[name]:value}))}
 function unit(name:string,value:string){setForm(current=>({...current,firstUnit:{...current.firstUnit,[name]:name==='state'?value.toUpperCase():value}}))}
 async function add(e:React.FormEvent){e.preventDefault();if(busy)return;setError('');setBusy(true);try{const created:any=await api('/customers',{method:'POST',body:JSON.stringify(form)});router.push('/clientes/'+created.id)}catch(e:any){setError(e?.message??'Não foi possível salvar o cliente e a unidade.');setBusy(false)}}
 async function remove(id:string,name:string){if(!confirm('Excluir '+name+' da listagem? O histórico será preservado.'))return;try{await api('/customers/'+id,{method:'DELETE'});await load()}catch(e:any){setError(e?.message??'Não foi possível excluir o cliente.')}}
 return <main className="shell">
  <section className="hero"><div><span className="eyebrow">CLIENTES</span><h1>Clientes e equipamentos</h1><p>Cadastre, localize e acompanhe os equipamentos vinculados a cada cliente.</p></div></section>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="grid two">
   <form className="card formGrid" onSubmit={add}>
    <h3 className="full">Novo cliente</h3>
    <div className="field"><label>Tipo</label><select value={form.type} onChange={e=>customer('type',e.target.value)}><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></div>
    <div className="field"><label>Nome / razão social</label><input value={form.name} onChange={e=>customer('name',e.target.value)} required minLength={2}/></div>
    <div className="field"><label>Nome fantasia</label><input value={form.tradeName} onChange={e=>customer('tradeName',e.target.value)}/></div>
    <div className="field"><label>{form.type==='PJ'?'CNPJ':'CPF'}</label><input value={form.cpfCnpj} onChange={e=>customer('cpfCnpj',e.target.value)}/></div>
    <div className="field"><label>Telefone</label><input type="tel" value={form.phone} onChange={e=>customer('phone',e.target.value)}/></div>
    <div className="field"><label>WhatsApp</label><input type="tel" value={form.whatsapp} onChange={e=>customer('whatsapp',e.target.value)}/></div>
    <div className="field full"><label>E-mail</label><input type="email" value={form.email} onChange={e=>customer('email',e.target.value)}/></div>
    <div className="field full"><label>Observações</label><textarea value={form.notes} onChange={e=>customer('notes',e.target.value)}/></div>
    <h3 className="full">Primeira unidade / endereço</h3>
    <div className="field"><label>Nome da unidade</label><input value={form.firstUnit.name} onChange={e=>unit('name',e.target.value)} required minLength={2}/></div>
    <div className="field"><label>CEP</label><input value={form.firstUnit.cep} onChange={e=>unit('cep',e.target.value)}/></div>
    <div className="field"><label>Rua</label><input value={form.firstUnit.street} onChange={e=>unit('street',e.target.value)}/></div>
    <div className="field"><label>Número</label><input value={form.firstUnit.number} onChange={e=>unit('number',e.target.value)}/></div>
    <div className="field"><label>Complemento</label><input value={form.firstUnit.complement} onChange={e=>unit('complement',e.target.value)}/></div>
    <div className="field"><label>Bairro</label><input value={form.firstUnit.neighborhood} onChange={e=>unit('neighborhood',e.target.value)}/></div>
    <div className="field"><label>Cidade</label><input value={form.firstUnit.city} onChange={e=>unit('city',e.target.value)}/></div>
    <div className="field"><label>UF</label><input value={form.firstUnit.state} onChange={e=>unit('state',e.target.value)} maxLength={2}/></div>
    <div className="field full"><label>Ponto de referência</label><input value={form.firstUnit.reference} onChange={e=>unit('reference',e.target.value)}/></div>
    <button className="btn btnPrimary full" disabled={busy}>{busy?'Salvando cliente e unidade…':'Salvar e cadastrar ambiente'}</button>
   </form>
   <section className="card">
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
     <h3 style={{margin:0}}>Clientes cadastrados</h3><b>{list.length} cliente(s)</b>
    </div>
    <div className="field" style={{marginTop:16}}><label>Buscar cliente</label><input placeholder="Nome, telefone, CPF/CNPJ ou código" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    {!filtered.length&&<p className="muted">Nenhum cliente encontrado.</p>}
    <div style={{display:'grid',gap:12,marginTop:16}}>
     {filtered.map(c=><article className="portal-item" key={c.id} style={{padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start'}}>
       <div>
        <a href={'/clientes/'+c.id} style={{fontSize:18,fontWeight:800}}>{c.name}</a>
        <div className="muted">{c.phone||c.whatsapp||'Telefone não informado'}</div>
        <div style={{marginTop:8}}><b>Qtd. equipamentos: {c._count?.equipment??0}</b> · {c.units?.length??0} unidade(s)</div>
       </div>
       <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
        <a className="btn" href={'/clientes/'+c.id}>Abrir / editar</a>
        <button className="btn" type="button" onClick={()=>remove(c.id,c.name)}>Excluir</button>
       </div>
      </div>
     </article>)}
    </div>
   </section>
  </div>
 </main>
}