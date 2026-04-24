import { useEffect, useState } from 'react';
import { api, Alert, Zone, Display, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { ws } from '../lib/ws';

export default function Alerts({ user }: { user: User }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [displays, setDisplays] = useState<Display[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    title: '', body: '', severity: 'warn' as Alert['severity'],
    target_type: 'all' as Alert['target_type'], target_id: 0,
    duration_seconds: 300, play_sound: false,
  });

  const canSend = ['admin', 'comunicaciones', 'seguridad'].includes(user.role);

  const load = async () => {
    const [a, z, d] = await Promise.all([api.listAlerts(), api.listZones(), api.listDisplays()]);
    setAlerts(a.alerts);
    setZones(z.zones);
    setDisplays(d.displays);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => ws.subscribe(msg => {
    if (msg.type === 'alert' || msg.type === 'alert_dismiss') load();
  }), []);

  const send = async () => {
    const payload: any = { ...form };
    if (form.target_type === 'all') delete payload.target_id;
    await api.sendAlert(payload);
    setModal(false);
    setForm({ ...form, title: '', body: '' });
    load();
  };

  const template = (t: 'evacuacion' | 'simulacro' | 'cambio_turno') => {
    const templates = {
      evacuacion: { title: '🚨 EVACUACIÓN', body: 'Evacuar el edificio siguiendo las rutas señalizadas', severity: 'emergency' as const, duration_seconds: 600, play_sound: true },
      simulacro:  { title: 'Simulacro de evacuación', body: 'Simulacro en curso — seguir indicaciones de HSE', severity: 'warn' as const, duration_seconds: 300, play_sound: false },
      cambio_turno: { title: 'Cambio de turno', body: 'Inicia el turno de la tarde', severity: 'info' as const, duration_seconds: 120, play_sound: false },
    };
    setForm({ ...form, ...templates[t] });
  };

  return (
    <>
      <PageHeader title="Alertas" subtitle="Comunicaciones urgentes en tiempo real a las pantallas"
        actions={canSend && <button onClick={() => setModal(true)} className="btn-primary">+ Enviar alerta</button>} />

      <div className="card overflow-x-auto">
        <table className="table-simple">
          <thead>
            <tr><th>Título</th><th>Severidad</th><th>Objetivo</th><th>Enviado por</th><th>Creada</th><th>Vence</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id}>
                <td>
                  <div className="font-medium">{a.title}</div>
                  {a.body && <div className="text-xs text-slate-500 truncate max-w-md">{a.body}</div>}
                </td>
                <td><SeverityBadge severity={a.severity} /></td>
                <td className="text-sm">
                  {a.target_type === 'all' ? 'Todas' :
                   a.target_type === 'zone' ? `Zona: ${zones.find(z => z.id === a.target_id)?.name ?? a.target_id}` :
                   `Pantalla: ${displays.find(d => d.id === a.target_id)?.name ?? a.target_id}`}
                </td>
                <td className="text-xs text-slate-500">{a.sent_by_name ?? '—'}</td>
                <td className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString('es-AR')}</td>
                <td className="text-xs text-slate-500">{a.ends_at ? new Date(a.ends_at).toLocaleString('es-AR') : '—'}</td>
                <td>
                  {a.active ? <span className="badge badge-error">Activa</span> : <span className="badge badge-offline">Cerrada</span>}
                </td>
                <td className="text-right">
                  {canSend && a.active && <button onClick={() => api.dismissAlert(a.id).then(load)} className="btn-ghost text-xs">Cerrar</button>}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-8">Sin alertas emitidas.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Enviar alerta" size="lg"
        footer={<><button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button><button onClick={send} className="btn-danger" disabled={!form.title}>🚨 Enviar</button></>}>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => template('evacuacion')} className="btn-secondary text-sm">📢 Plantilla: Evacuación</button>
            <button onClick={() => template('simulacro')} className="btn-secondary text-sm">⚠ Plantilla: Simulacro</button>
            <button onClick={() => template('cambio_turno')} className="btn-secondary text-sm">🕐 Plantilla: Cambio de turno</button>
          </div>
          <div><label className="label">Título</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Texto principal que aparecerá en pantalla" /></div>
          <div><label className="label">Mensaje (opcional)</label><textarea className="input" rows={3} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Severidad</label>
              <select className="input" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as any })}>
                <option value="info">ℹ Info</option>
                <option value="warn">⚠ Advertencia</option>
                <option value="critical">🚨 Crítica</option>
                <option value="emergency">🚨🚨 Emergencia</option>
              </select>
            </div>
            <div>
              <label className="label">Duración (seg)</label>
              <input type="number" min={5} max={86400} className="input" value={form.duration_seconds} onChange={e => setForm({ ...form, duration_seconds: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Destino</label>
            <div className="flex gap-4 flex-wrap">
              <label><input type="radio" checked={form.target_type === 'all'} onChange={() => setForm({ ...form, target_type: 'all' })} /> Todas las pantallas</label>
              <label><input type="radio" checked={form.target_type === 'zone'} onChange={() => setForm({ ...form, target_type: 'zone' })} /> Por zona</label>
              <label><input type="radio" checked={form.target_type === 'display'} onChange={() => setForm({ ...form, target_type: 'display' })} /> Pantalla específica</label>
            </div>
          </div>
          {form.target_type === 'zone' && (
            <select className="input" value={form.target_id} onChange={e => setForm({ ...form, target_id: Number(e.target.value) })}>
              <option value={0}>— seleccionar —</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          )}
          {form.target_type === 'display' && (
            <select className="input" value={form.target_id} onChange={e => setForm({ ...form, target_id: Number(e.target.value) })}>
              <option value={0}>— seleccionar —</option>
              {displays.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.play_sound} onChange={e => setForm({ ...form, play_sound: e.target.checked })} />
            Reproducir sonido en las pantallas
          </label>
        </div>
      </Modal>
    </>
  );
}

function SeverityBadge({ severity }: { severity: Alert['severity'] }) {
  const map = {
    info:      { label: 'ℹ Info',        cls: 'bg-blue-100 text-blue-800' },
    warn:      { label: '⚠ Warn',        cls: 'bg-amber-100 text-amber-800' },
    critical:  { label: '🚨 Critical',   cls: 'bg-red-100 text-red-800' },
    emergency: { label: '🚨🚨 Emergency', cls: 'bg-red-600 text-white' },
  };
  const { label, cls } = map[severity];
  return <span className={`badge ${cls}`}>{label}</span>;
}
