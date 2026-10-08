"use client";
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {api} from '../../../lib/api';

export default function EquipmentQr() {
  const params = useParams<{token: string}>();
  const [equipment, setEquipment] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/equipment/by-qr/' + encodeURIComponent(params.token))
      .then(data => {if (active) setEquipment(data);})
      .catch(err => {if (active) setError(err.message);});
    return () => {active = false;};
  }, [params.token]);
  return <main>
    <h1>Equipamento</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {!equipment && !error && <p>Carregando equipamento…</p>}
    {equipment && <section className="card">
      <h2>{equipment.assetCode}</h2>
      <p>Cliente: {equipment.customer.name}</p>
      <p>Unidade: {equipment.unit.name}</p>
      <p>Ambiente: {equipment.environment?.name ?? 'Não informado'}</p>
      <p>Tipo: {equipment.equipmentType}</p>
      <p>Capacidade: {equipment.capacityBtu ?? 'Não informada'} BTU/h</p>
      <p>Número de série: {equipment.serialNumber || 'Não informado'}</p>
      <Link href={'/clientes/' + equipment.customerId}>Abrir cliente</Link>
    </section>}
  </main>;
}
