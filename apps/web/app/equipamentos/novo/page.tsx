"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";

export default function NovoEquip() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [envs, setEnvs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unitRequest = useRef(0);
  const [created, setCreated] = useState<any>();
  const [f, setF] = useState<any>({
    customerId: "",
    unitId: "",
    environmentId: "",
    equipmentType: "SPLIT",
    capacityBtu: 12000,
    technology: "INVERTER",
    voltage: 220,
    refrigerant: "R32",
    serialNumber: "",
    installation: {
      liquidPipe: "",
      gasPipe: "",
      pipeLengthM: 0,
      vacuumMicrons: 0,
      tightnessTest: false,
    },
  });

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const customerList = await api("/customers");
        if (!active) return;

        setCustomers(customerList);

        const params = new URLSearchParams(window.location.search);
        const customerId = params.get("customerId") ?? "";
        const unitId = params.get("unitId") ?? "";
        const environmentId = params.get("environmentId") ?? "";

        if (!customerId) return;

        const initialUnits =
          customerList.find((x: any) => x.id === customerId)?.units ?? [];
        setUnits(initialUnits);

        let initialEnvs: any[] = [];
        if (unitId) {
          initialEnvs = await api("/units/" + unitId + "/environments");
          if (!active) return;
          setEnvs(initialEnvs);
        }

        setF((prev: any) => ({
          ...prev,
          customerId,
          unitId: initialUnits.some((x: any) => x.id === unitId) ? unitId : "",
          environmentId: initialEnvs.some((x: any) => x.id === environmentId)
            ? environmentId
            : "",
        }));
      } catch (err: any) {
        if (active) setError(err?.message ?? "Não foi possível carregar os dados do equipamento.");
      }
    }

    loadInitialData();

    return () => {
      active = false;
      unitRequest.current++;
    };
  }, []);

  function customer(id: string) {
    unitRequest.current++;
    setError("");
    setF({ ...f, customerId: id, unitId: "", environmentId: "" });
    setUnits(customers.find((x) => x.id === id)?.units ?? []);
    setEnvs([]);
  }

  async function unit(id: string) {
    const request = ++unitRequest.current;
    setF((prev: any) => ({ ...prev, unitId: id, environmentId: "" }));
    setEnvs([]);
    setError("");
    if (!id) return;

    try {
      const list = await api("/units/" + id + "/environments");
      if (request === unitRequest.current) setEnvs(list);
    } catch (err: any) {
      if (request === unitRequest.current) setError(err.message);
    }
  }

  async function save(e: any) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const body = { ...f, environmentId: f.environmentId || undefined };
      setCreated(
        await api("/equipment", {
          method: "POST",
          body: JSON.stringify(body),
        })
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function qr() {
    const b = await api("/equipment/" + created.id + "/qr");
    const url = URL.createObjectURL(b as Blob);
    window.open(url, "_blank");
  }

  async function photo(file: File) {
    const fd = new FormData();
    fd.append("category", "NAMEPLATE");
    fd.append("file", file);
    await api("/uploads/equipment/" + created.id + "/photo", {
      method: "POST",
      body: fd,
    });
    alert("Foto enviada");
  }

  return (
    <main>
      <h1>Novo equipamento</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form className="card grid" onSubmit={save}>
        <select
          required
          value={f.customerId}
          onChange={(e) => customer(e.target.value)}
        >
          <option value="">Cliente</option>
          {customers.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          required
          value={f.unitId}
          onChange={(e) => unit(e.target.value)}
        >
          <option value="">Unidade</option>
          {units.map((u) => (
            <option value={u.id} key={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select
          value={f.environmentId}
          onChange={(e) => setF({ ...f, environmentId: e.target.value })}
        >
          <option value="">Ambiente</option>
          {envs.map((x) => (
            <option value={x.id} key={x.id}>
              {x.name}
            </option>
          ))}
        </select>

        {["equipmentType", "serialNumber", "technology", "refrigerant"].map(
          (k) => (
            <input
              key={k}
              placeholder={k}
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
            />
          )
        )}

        <input
          type="number"
          placeholder="BTU/h"
          value={f.capacityBtu}
          onChange={(e) => setF({ ...f, capacityBtu: +e.target.value })}
        />

        <input
          type="number"
          placeholder="Tensão"
          value={f.voltage}
          onChange={(e) => setF({ ...f, voltage: +e.target.value })}
        />

        <h3>Instalação</h3>

        <input
          placeholder="Bitola líquido"
          onChange={(e) =>
            setF({
              ...f,
              installation: { ...f.installation, liquidPipe: e.target.value },
            })
          }
        />

        <input
          placeholder="Bitola gás"
          onChange={(e) =>
            setF({
              ...f,
              installation: { ...f.installation, gasPipe: e.target.value },
            })
          }
        />

        <input
          type="number"
          placeholder="Comprimento linha (m)"
          onChange={(e) =>
            setF({
              ...f,
              installation: {
                ...f.installation,
                pipeLengthM: +e.target.value,
              },
            })
          }
        />

        <input
          type="number"
          placeholder="Vácuo (microns)"
          onChange={(e) =>
            setF({
              ...f,
              installation: {
                ...f.installation,
                vacuumMicrons: +e.target.value,
              },
            })
          }
        />

        <label>
          <input
            type="checkbox"
            onChange={(e) =>
              setF({
                ...f,
                installation: {
                  ...f.installation,
                  tightnessTest: e.target.checked,
                },
              })
            }
          />{" "}
          Teste de estanqueidade aprovado
        </label>

        <button disabled={busy}>
          {busy ? "Salvando…" : "Salvar equipamento"}
        </button>
      </form>

      {created && (
        <section className="card">
          <h2>{created.assetCode}</h2>
          <p>Equipamento cadastrado.</p>
          <button type="button" onClick={qr}>
            Abrir QR Code
          </button>
          <p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                e.target.files?.[0] && photo(e.target.files[0])
              }
            />
          </p>
        </section>
      )}
    </main>
  );
}
