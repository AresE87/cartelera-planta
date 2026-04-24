import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Display, Layout, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';

export default function DisplayDetail({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>();
  const [display, setDisplay] = useState<Display | null>(null);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [heartbeats, setHeartbeats] = useState<any[]>([]);
  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  const load = async () => {
    if (!id) return;
    const [d, ls] = await Promise.all([api.getDisplay(Number(id)), api.listLayouts()]);
    setDisplay(d.display as unknown as Display);
    setHeartbeats(d.heartbeats);
    setLayouts(ls.layouts);
  };
  useEffect(() => { load(); }, [id]);

  if (!display) return <div className="text-slate-500">Cargando...</div>;

  return (
    <>
      <PageHeader
        title={display.name}
        subtitle={display.description ?? ''}
        actions={<Link to="/displays" className="btn-secondary">← Volver</Link>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info */}
        <div className="card lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label="Estado"><StatusBadge status={display.status} /></Field>
            <Field label="Zona">{display.zone_name ?? '—'}</Field>
            <Field label="Layout actual">{display.current_layout_name ?? '—'}</Field>
            <Field label="Resolución">{display.resolution}</Field>
            <Field label="Orientación">{display.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}</Field>
            <Field label="Última conexión">{display.last_seen_at ? new Date(display.last_seen_at).toLocaleString('es-AR') : 'Nunca'}</Field>
          </div>

          {display.pairing_code && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <strong>Código de emparejamiento pendiente:</strong> <span className="font-mono text-lg tracking-widest">{display.pairing_code}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card">
          <h3 className="font-semibold mb-3">Acciones</h3>
          <div className="space-y-2">
            {canWrite && (
              <>
                <div>
                  <label className="label">Asignar layout</label>
                  <select
                    className="input"
                    value={display.current_layout_id ?? ''}
                    onChange={e => e.target.value && api.setLayout(display.id, Number(e.target.value)).then(load)}
                  >
                    <option value="">— sin asignar —</option>
                    {layouts.filter(l => l.published).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <button onClick={() => api.reloadDisplay(display.id)} className="btn-secondary w-full">⟳ Forzar reload</button>
                {user.role === 'admin' && (
                  <button onClick={async () => {
                    if (!confirm('¿Regenerar código de emparejamiento? La pantalla se desvinculará.')) return;
                    const r = await api.regeneratePairing(display.id);
                    alert(`Nuevo código: ${r.pairing_code}`);
                    load();
                  }} className="btn-secondary w-full">Regenerar pairing</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Heartbeats */}
      <div className="card mt-6">
        <h3 className="font-semibold mb-3">Últimos heartbeats</h3>
        {heartbeats.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin heartbeats registrados.</p>
        ) : (
          <table className="table-simple">
            <thead><tr><th>Timestamp</th><th>CPU</th><th>Memoria</th><th>Uptime</th><th>Versión</th></tr></thead>
            <tbody>
              {heartbeats.map((h, i) => (
                <tr key={i}>
                  <td className="text-sm">{new Date(h.created_at).toLocaleString('es-AR')}</td>
                  <td>{h.cpu ?? '—'}</td>
                  <td>{h.memory ?? '—'}</td>
                  <td>{h.uptime_s ? `${Math.floor(h.uptime_s / 60)} min` : '—'}</td>
                  <td>{h.version ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}
