"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";

export default function Cliente() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [c, setC] = useState<any>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customerForm, setCustomerForm] = useState<any>(null);
  const [editingUnitId,setEditingUnitId]=useState("");
  const [unitForm,setUnitForm]=useState<any>(null);
  const [editingEnvId,setEditingEnvId]=useState("");
  const [envForm,setEnvForm]=useState<any>(null);
  const [u, setU] = useState({
    name: "",
    cep: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
  });
  const [e, setE] = useState({
    unitId: "",
    name: "",
    floor: "",
    sector: "",
  });

  const load = async () => {
    if (!id) return;
    try {
      const customer:any=await api("/customers/" + id);
      setC(customer);
      setCustomerForm({type:customer.type,name:customer.name,legalName:customer.legalName??"",tradeName:customer.tradeName??"",cpfCnpj:customer.cpfCnpj??"",phone:customer.phone??"",whatsapp:customer.whatsapp??"",email:customer.email??"",notes:customer.notes??""});
      setError("");
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível carregar o cliente.");
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  async function saveCustomer(ev:any){
    ev.preventDefault();
    if(!id||busy||!customerForm)return;
    setBusy(true);setError("");
    try{
      await api("/customers/"+id,{method:"PATCH",body:JSON.stringify(customerForm)});
      setEditing(false);
      await load();
    }catch(err:any){setError(err?.message??"Não foi possível atualizar o cliente.")}
    finally{setBusy(false)}
  }

  async function saveUnit(ev:any){
    ev.preventDefault();
    if(!editingUnitId||!unitForm||busy)return;
    setBusy(true);setError("");
    try{await api("/units/"+editingUnitId,{method:"PATCH",body:JSON.stringify(unitForm)});setEditingUnitId("");setUnitForm(null);await load()}
    catch(err:any){setError(err?.message??"Não foi possível atualizar a unidade.")}
    finally{setBusy(false)}
  }

  async function saveEnvironment(ev:any){
    ev.preventDefault();
    if(!editingEnvId||!envForm||busy)return;
    setBusy(true);setError("");
    try{await api("/units/environments/"+editingEnvId,{method:"PATCH",body:JSON.stringify(envForm)});setEditingEnvId("");setEnvForm(null);await load()}
    catch(err:any){setError(err?.message??"Não foi possível atualizar o ambiente.")}
    finally{setBusy(false)}
  }

  async function addUnit(ev: any) {
    ev.preventDefault();
    if (!id || busy) return;
    setBusy(true);
    setError("");
    try {
    await api("/customers/" + id + "/units", {
      method: "POST",
      body: JSON.stringify(u),
    });

    setU({
      name: "",
      cep: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
    });

    await load();
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível salvar a unidade.");
    } finally { setBusy(false); }
  }

  async function addEnv(ev: any) {
    ev.preventDefault();
    if (!e.unitId || busy) return;
    setBusy(true);
    setError("");
    try {
    await api("/units/" + e.unitId + "/environments", {
      method: "POST",
      body: JSON.stringify({
        name: e.name,
        floor: e.floor,
        sector: e.sector,
      }),
    });

    setE({
      unitId: "",
      name: "",
      floor: "",
      sector: "",
    });

    await load();
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível salvar o ambiente.");
    } finally { setBusy(false); }
  }

  if (!id || !c) return <main>{error ? <><p className="error" role="alert">{error}</p><button onClick={load}>Tentar novamente</button></> : "Carregando..."}</main>;

  return (
    <main>
      <h1>{c.name}</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <section className="card">
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <h2 style={{marginBottom:4}}>Dados do cliente</h2>
            <p className="muted" style={{margin:0}}>{c.phone||c.whatsapp||"Telefone não informado"} · {c.cpfCnpj||"CPF/CNPJ não informado"} · {c.equipment?.length??0} equipamento(s)</p>
          </div>
          <button type="button" onClick={()=>setEditing(v=>!v)}>{editing?"Cancelar":"Editar cliente"}</button>
        </div>
        {editing&&customerForm&&<form onSubmit={saveCustomer} className="grid" style={{marginTop:16}}>
          <select value={customerForm.type} onChange={e=>setCustomerForm({...customerForm,type:e.target.value})}><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select>
          <input placeholder="Nome / razão social" required minLength={2} value={customerForm.name} onChange={e=>setCustomerForm({...customerForm,name:e.target.value})}/>
          <input placeholder="Nome fantasia" value={customerForm.tradeName} onChange={e=>setCustomerForm({...customerForm,tradeName:e.target.value})}/>
          <input placeholder={customerForm.type==="PJ"?"CNPJ":"CPF"} value={customerForm.cpfCnpj} onChange={e=>setCustomerForm({...customerForm,cpfCnpj:e.target.value})}/>
          <input placeholder="Telefone" value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})}/>
          <input placeholder="WhatsApp" value={customerForm.whatsapp} onChange={e=>setCustomerForm({...customerForm,whatsapp:e.target.value})}/>
          <input placeholder="E-mail" type="email" value={customerForm.email} onChange={e=>setCustomerForm({...customerForm,email:e.target.value})}/>
          <textarea placeholder="Observações" value={customerForm.notes} onChange={e=>setCustomerForm({...customerForm,notes:e.target.value})}/>
          <button disabled={busy}>{busy?"Salvando…":"Salvar alterações"}</button>
        </form>}
      </section>

      <section className="card">
        <h2>Nova unidade</h2>

        <form onSubmit={addUnit} className="grid">
          {["name", "cep", "street", "number", "neighborhood", "city", "state"].map(
            (k) => (
              <input
                key={k}
                required={k === "name"}
                minLength={k === "name" ? 2 : undefined}
                maxLength={k === "state" ? 2 : undefined}
                placeholder={k === "name" ? "Nome da unidade" : k.toUpperCase()}
                value={(u as any)[k]}
                onChange={(x) => setU({ ...u, [k]: x.target.value })}
              />
            )
          )}

          <button disabled={busy}>{busy ? "Salvando…" : "Salvar unidade"}</button>
        </form>
      </section>

      <section className="card">
        <h2>Novo ambiente</h2>

        <form onSubmit={addEnv} className="grid">
          <select
            required
            value={e.unitId}
            onChange={(x) => setE({ ...e, unitId: x.target.value })}
          >
            <option value="">Selecione a unidade</option>

            {c.units.map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>

          <input
            required
            minLength={2}
            placeholder="Ambiente (ex.: Sala Maker)"
            value={e.name}
            onChange={(x) => setE({ ...e, name: x.target.value })}
          />

          <input
            placeholder="Andar"
            value={e.floor}
            onChange={(x) => setE({ ...e, floor: x.target.value })}
          />

          <input
            placeholder="Setor"
            value={e.sector}
            onChange={(x) => setE({ ...e, sector: x.target.value })}
          />

          <button disabled={busy || !e.unitId}>{busy ? "Salvando…" : "Salvar ambiente"}</button>
        </form>
      </section>

      <h2>Unidades e ambientes</h2>

      {c.units.map((x: any) => (
        <div className="card" key={x.id}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <div><b>{x.name}</b><p>{[x.street, x.number, x.city, x.state].filter(Boolean).join(", ")||"Endereço não informado"}</p></div>
            <button type="button" onClick={()=>{setEditingUnitId(x.id);setUnitForm({name:x.name,cep:x.cep??"",street:x.street??"",number:x.number??"",complement:x.complement??"",neighborhood:x.neighborhood??"",city:x.city??"",state:x.state??"PB",reference:x.reference??""})}}>Editar unidade</button>
          </div>
          {editingUnitId===x.id&&unitForm&&<form onSubmit={saveUnit} className="grid" style={{marginBottom:16}}>
            <input placeholder="Nome da unidade" value={unitForm.name} onChange={e=>setUnitForm({...unitForm,name:e.target.value})}/>
            <input placeholder="CEP" value={unitForm.cep} onChange={e=>setUnitForm({...unitForm,cep:e.target.value})}/>
            <input placeholder="Rua" value={unitForm.street} onChange={e=>setUnitForm({...unitForm,street:e.target.value})}/>
            <input placeholder="Número" value={unitForm.number} onChange={e=>setUnitForm({...unitForm,number:e.target.value})}/>
            <input placeholder="Complemento" value={unitForm.complement} onChange={e=>setUnitForm({...unitForm,complement:e.target.value})}/>
            <input placeholder="Bairro" value={unitForm.neighborhood} onChange={e=>setUnitForm({...unitForm,neighborhood:e.target.value})}/>
            <input placeholder="Cidade" value={unitForm.city} onChange={e=>setUnitForm({...unitForm,city:e.target.value})}/>
            <input placeholder="UF" maxLength={2} value={unitForm.state} onChange={e=>setUnitForm({...unitForm,state:e.target.value.toUpperCase()})}/>
            <button disabled={busy}>{busy?"Salvando…":"Salvar unidade"}</button>
            <button type="button" onClick={()=>{setEditingUnitId("");setUnitForm(null)}}>Cancelar</button>
          </form>}
          <div style={{display:"grid",gap:8}}>
          {x.environments.map((a: any) => (
            <div key={a.id} style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <a className="pill" href={`/equipamentos/novo?customerId=${encodeURIComponent(id)}&unitId=${encodeURIComponent(x.id)}&environmentId=${encodeURIComponent(a.id)}`}>{a.name}</a>
              <button type="button" onClick={()=>{setEditingEnvId(a.id);setEnvForm({name:a.name,floor:a.floor??"",sector:a.sector??"",description:a.description??""})}}>Editar ambiente</button>
              {editingEnvId===a.id&&envForm&&<form onSubmit={saveEnvironment} className="grid" style={{width:"100%"}}>
                <input placeholder="Ambiente" value={envForm.name} onChange={e=>setEnvForm({...envForm,name:e.target.value})}/>
                <input placeholder="Andar" value={envForm.floor} onChange={e=>setEnvForm({...envForm,floor:e.target.value})}/>
                <input placeholder="Setor" value={envForm.sector} onChange={e=>setEnvForm({...envForm,sector:e.target.value})}/>
                <input placeholder="Descrição" value={envForm.description} onChange={e=>setEnvForm({...envForm,description:e.target.value})}/>
                <button disabled={busy}>{busy?"Salvando…":"Salvar ambiente"}</button>
                <button type="button" onClick={()=>{setEditingEnvId("");setEnvForm(null)}}>Cancelar</button>
              </form>}
            </div>
          ))}
          </div>
        </div>
      ))}
    </main>
  );
}
