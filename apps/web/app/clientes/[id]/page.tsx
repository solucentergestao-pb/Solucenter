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
      setC(await api("/customers/" + id));
      setError("");
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível carregar o cliente.");
    }
  };

  useEffect(() => {
    load();
  }, [id]);

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
          <b>{x.name}</b>
          <p>{[x.street, x.number, x.city, x.state].filter(Boolean).join(", ")}</p>

          {x.environments.map((a: any) => (
            <span className="pill" key={a.id}>
              {a.name}
            </span>
          ))}
        </div>
      ))}
    </main>
  );
}
