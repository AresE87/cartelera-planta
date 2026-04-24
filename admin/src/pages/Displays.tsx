import { useEffect, useState } from 'react';
import { api, Display, Zone, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Link } from 'react-router-dom';

export default function Displays({ user }: { user: User }) {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [modal, setModal] = useState<{ open: boolean; pairingCode?: string; displayId?: number }>({ open: false });
  const [form, setForm] = useState({ name: '', description: '', zone_id: null as number | null, resolution: '1920x1080', orientation: 'landscape' as 'landscape' | 'portrait' });

  const canWrite = ['admin', 'comunicaciones'].includes(user.role);

  const load = async () => {
    const [d, z] = await Promise.all([api.listDisplays(), api.listZones()]);
    setDisplays(d.displays);
    setZones(z.zones);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const res = await api.createDisplay(form);
    setModal({ open: true, pairingCode: res.pairing_code, displayId: res.id });
    setForm({ name: '', description: '', zone_id: null, resolution: '1920x1080', orientation: 'landscape' });
    load();
  };

  return (
    <>
      <PageHeader title="Pantallas" subtitle="Dispositivos que muestran contenido"
        actions={canWrite && <button onClick={() => setModal({ open: true })} className="btn-primary">+ Nueva pantalla</button>} />

      <div className="card overflow-x-auto">
        <table className="table-simple">
          <thead>
            <tr><th>Nombre</th><th>Zona</th><th>Estado</th><th>Layout actual</th><th>Resolución</th><th>Última conexión</th><th></th></tr>
          </thead>
          <tbody>
            {displays.map(d => (
              <tr key={d.id}>
                <td>
                  <Link to={`/displays/${d.id}`} className="text-brand-700 font-medium hover:underline">{d.name}</Link>
                  {d.pairing_code && <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Pairing: {d.pairing_code}</span>}
                </td>
                <td>{d.zone_name ?? '—'}</td>
                <td><StatusBadge status={d.status} /></td>
                <td className="text-sm">{d.current_layout_name ?? '—'}</td>
                <td className="text-sm text-slate-500">{d.resolution}</td>
                <td className="text-sm text-slate-500">{d.last_seen_at ? relTime(d.last_seen_at) : 'Nunca'}</td>
                <td className="text-right">
                  {canWrite && <button onClick={() => api.reloadDisplay(d.id)} className="btn-ghost text-xs">⟳ Reload</button>}
                </td>
              </tr>
            ))}
            {displays.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">Sin pantallas registradas.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal.open && !modal.pairingCode}
        onClose={() => setModal({ open: false })}
        title="Nueva pantalla"
        footer={<>
          <button onClick={() => setModal({ open: false })} className="btn-secondary">Cancelar</button>
          <button onClick={create} className="btn-primary" disabled={!form.name}>Crear + generar código</button>
        </>}
      >
        <div className="space-y-4">
          <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="TV Comedor principal" /></div>
          <div><label className="label">Descripción</label><input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="label">Zona</label>
            <select className="input" value={form.zone_id ?? ''} onChange={e => setForm({ ...form, zone_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sin asignar</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Resolución</label>
              <select className="input" value={form.resolution} onChange={e => setForm({ ...form, resolution: e.target.value })}>
                <option>1920x1080</option>
                <option>2560x1440</option>
                <option>3840x2160</option>
                <option>1280x720</option>
              </select>
            </div>
            <div><label className="label">Orientación</label>
              <select className="input" value={form.orientation} onChange={e => setForm({ ...form, orientation: e.target.value as any })}>
                <option value="landscape">Horizontal</option>
                <option value="portrait">Vertical</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Pairing code reveal */}
      <Modal
        open={!!modal.pairingCode}
        onClose={() => setModal({ open: false })}
        title="Código de emparejamiento"
        footer={<button onClick={() => setModal({ open: false })} className="btn-primary">Listo</button>}
      >
        <div className="text-center py-4">
          <p className="mb-2 text-slate-600">Ingresá este código en la pantalla física (válido por 30 minutos):</p>
          <div className="text-6xl font-mono font-bold tracking-[0.3em] my-6 bg-slate-100 py-6 px-4 rounded-xl">
            {modal.pairingCode}
          </div>
          <p className="text-xs text-slate-500">Abrí <code>{location.origin}/display</code> en la pantalla y escribí este código.</p>
        </div>
      </Modal>
    </>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'hace < 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR');
}
