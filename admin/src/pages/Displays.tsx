import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Display, Zone, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';

export default function Displays({ user }: { user: User }) {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [modal, setModal] = useState<{ open: boolean; pairingCode?: string; displayId?: number }>({ open: false });
  const [form, setForm] = useState({ name: '', description: '', zone_id: null as number | null, resolution: '1920x1080', orientation: 'landscape' as 'landscape' | 'portrait' });
  const [busy, setBusy] = useState(false);

  const canWrite = ['admin', 'comunicaciones'].includes(user.role);

  const load = async () => {
    const [d, z] = await Promise.all([api.listDisplays(), api.listZones()]);
    setDisplays(d.displays);
    setZones(z.zones);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: displays.length,
    online: displays.filter(d => d.status === 'online').length,
    pending: displays.filter(d => !!d.pairing_code).length,
    withoutLayout: displays.filter(d => !d.current_layout_id).length,
  }), [displays]);

  const create = async () => {
    if (!form.name || busy) return;
    setBusy(true);
    try {
      const res = await api.createDisplay(form);
      setModal({ open: true, pairingCode: res.pairing_code, displayId: res.id });
      setForm({ name: '', description: '', zone_id: null, resolution: '1920x1080', orientation: 'landscape' });
      load();
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async (display: Display) => {
    if (!canWrite) return;
    const res = await api.regeneratePairing(display.id);
    setModal({ open: true, pairingCode: res.pairing_code, displayId: display.id });
    load();
  };

  return (
    <>
      <PageHeader
        title="Pantallas"
        subtitle="TVs, monitores y players conectados a la cartelera"
        actions={canWrite && <button onClick={() => setModal({ open: true })} className="btn-primary">Nueva pantalla</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MiniStat label="Total" value={stats.total} />
        <MiniStat label="Online" value={stats.online} tone="green" />
        <MiniStat label="Por emparejar" value={stats.pending} tone={stats.pending ? 'amber' : 'slate'} />
        <MiniStat label="Sin layout" value={stats.withoutLayout} tone={stats.withoutLayout ? 'amber' : 'slate'} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-simple">
          <thead>
            <tr>
              <th>Pantalla</th>
              <th>Zona</th>
              <th>Estado</th>
              <th>Contenido</th>
              <th>Resolucion</th>
              <th>Ultima conexion</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displays.map(d => (
              <tr key={d.id}>
                <td>
                  <Link to={`/displays/${d.id}`} className="font-medium text-brand-700 hover:underline">{d.name}</Link>
                  {d.pairing_code && <div className="mt-1 text-xs text-amber-700">Pairing activo: <span className="font-mono font-semibold">{d.pairing_code}</span></div>}
                </td>
                <td>{d.zone_name ?? <span className="text-slate-400">Sin zona</span>}</td>
                <td><StatusBadge status={d.status} /></td>
                <td className="text-sm">{d.current_layout_name ?? <span className="text-slate-400">Sin layout</span>}</td>
                <td className="text-sm text-slate-500">{d.resolution} · {d.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</td>
                <td className="text-sm text-slate-500">{d.last_seen_at ? relTime(d.last_seen_at) : 'Nunca'}</td>
                <td className="text-right">
                  {canWrite && <div className="flex justify-end gap-1">
                    <button onClick={() => regenerate(d)} className="btn-ghost text-xs">Pairing</button>
                    <button onClick={() => api.reloadDisplay(d.id)} className="btn-ghost text-xs">Recargar</button>
                  </div>}
                </td>
              </tr>
            ))}
            {displays.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div className="text-lg font-semibold text-slate-800">No hay pantallas registradas</div>
                    {canWrite && <button onClick={() => setModal({ open: true })} className="btn-primary mt-4">Crear primera pantalla</button>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal.open && !modal.pairingCode}
        onClose={() => setModal({ open: false })}
        title="Nueva pantalla"
        footer={<>
          <button onClick={() => setModal({ open: false })} className="btn-secondary">Cancelar</button>
          <button onClick={create} className="btn-primary" disabled={!form.name || busy}>{busy ? 'Creando...' : 'Crear y emparejar'}</button>
        </>}
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="label">Nombre visible</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="TV comedor principal" />
          </div>
          <div>
            <label className="label">Zona</label>
            <select className="input" value={form.zone_id ?? ''} onChange={e => setForm({ ...form, zone_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sin asignar</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Resolucion</label>
              <select className="input" value={form.resolution} onChange={e => setForm({ ...form, resolution: e.target.value })}>
                <option value="1920x1080">Full HD · 1920x1080</option>
                <option value="3840x2160">4K · 3840x2160</option>
                <option value="1280x720">HD · 1280x720</option>
                <option value="1080x1920">Vertical · 1080x1920</option>
              </select>
            </div>
            <div>
              <label className="label">Orientacion</label>
              <select className="input" value={form.orientation} onChange={e => setForm({ ...form, orientation: e.target.value as any })}>
                <option value="landscape">Horizontal</option>
                <option value="portrait">Vertical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descripcion</label>
            <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ubicacion o referencia interna" />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!modal.pairingCode}
        onClose={() => setModal({ open: false })}
        title="Codigo de emparejamiento"
        footer={<button onClick={() => setModal({ open: false })} className="btn-primary">Listo</button>}
      >
        <div className="text-center">
          <div className="mx-auto mb-5 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-600">
            <div className="font-medium text-slate-900">URL del display</div>
            <div className="mt-1 font-mono text-brand-700">{location.origin}/display/</div>
            <div className="mt-3 font-medium text-slate-900">TV antigua</div>
            <div className="mt-1 font-mono text-slate-500">{location.origin}/display/tv.html</div>
          </div>
          <div className="text-6xl font-mono font-bold tracking-[0.28em] my-6 rounded-lg bg-slate-900 px-4 py-6 text-white">
            {modal.pairingCode}
          </div>
          <div className="text-sm text-slate-500">Valido por 30 minutos.</div>
        </div>
      </Modal>
    </>
  );
}

function MiniStat({ label, value, tone = 'slate' }: { label: string; value: number; tone?: string }) {
  const cls = {
    green: 'border-green-200 bg-green-50 text-green-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-white text-slate-900',
  }[tone] || 'border-slate-200 bg-white text-slate-900';
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'hace menos de 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-UY');
}
