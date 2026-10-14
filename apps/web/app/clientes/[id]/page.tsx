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

  async function saveUnit(ev:any, unitId:string){
    ev.preventDefault();
    if(!unitId||busy)return;
    const form = new FormData(ev.currentTarget);
    const payload = Object.fromEntries(form.entries());
    setBusy(true);setError("");
    try{await api("/units/"+unitId,{method:"PATCH",body:JSON.stringify(payload)});await load()}
    catch(err:any){setError(err?.message??"Não foi possível atualizar a unidade.")}
    finally{setBusy(false)}
  }

  async function saveEnvironment(ev:any, environmentId:string){
    ev.preventDefault();
    if(!environmentId||busy)return;
    const form = new FormData(ev.currentTarget);
    const payload = Object.fromEntries(form.entries());
    setBusy(true);setError("");
    try{await api("/units/environments/"+environmentId,{method:"PATCH",body:JSON.stringify(payload)});await load()}
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
          </div>
          <details style={{marginBottom:16}}>
            <summary style={{cursor:"pointer",fontWeight:600}}>Editar unidade</summary>
            <form onSubmit={(ev)=>saveUnit(ev,String(x.id))} className="grid" style={{marginTop:12}}>
              <input name="name" placeholder="Nome da unidade" defaultValue={x.name??""}/>
              <input name="cep" placeholder="CEP" defaultValue={x.cep??""}/>
              <input name="street" placeholder="Rua" defaultValue={x.street??""}/>
              <input name="number" placeholder="Número" defaultValue={x.number??""}/>
              <input name="complement" placeholder="Complemento" defaultValue={x.complement??""}/>
              <input name="neighborhood" placeholder="Bairro" defaultValue={x.neighborhood??""}/>
              <input name="city" placeholder="Cidade" defaultValue={x.city??""}/>
              <input name="state" placeholder="UF" maxLength={2} defaultValue={x.state??"PB"}/>
              <input name="reference" placeholder="Referência" defaultValue={x.reference??""}/>
              <button disabled={busy}>{busy?"Salvando…":"Salvar unidade"}</button>
            </form>
          </details>
          <div style={{display:"grid",gap:8}}>
          {x.environments.map((a: any) => (
            <div key={a.id} style={{display:"grid",gap:8}}>
              <a className="pill" href={`/equipamentos/novo?customerId=${encodeURIComponent(id)}&unitId=${encodeURIComponent(x.id)}&environmentId=${encodeURIComponent(a.id)}`}>{a.name}</a>
              <details>
                <summary style={{cursor:"pointer",fontWeight:600}}>Editar ambiente</summary>
                <form onSubmit={(ev)=>saveEnvironment(ev,String(a.id))} className="grid" style={{width:"100%",marginTop:12}}>
                  <input name="name" placeholder="Ambiente" defaultValue={a.name??""}/>
                  <input name="floor" placeholder="Andar" defaultValue={a.floor??""}/>
                  <input name="sector" placeholder="Setor" defaultValue={a.sector??""}/>
                  <input name="description" placeholder="Descrição" defaultValue={a.description??""}/>
                  <button disabled={busy}>{busy?"Salvando…":"Salvar ambiente"}</button>
                </form>
              </details>
            </div>
          ))}
          </div>
        </div>
      ))}
    </main>
  );
}
