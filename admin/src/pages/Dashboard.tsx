import { useEffect, useState } from 'react';
import { api, Display, Alert } from '../lib/api';
import { ws } from '../lib/ws';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({ online: 0, offline: 0, error: 0, total: 0 });

  const load = async () => {
    const d = await api.listDisplays();
    setDisplays(d.displays);
    const onl = d.displays.filter(x => x.status === 'online').length;
    const err = d.displays.filter(x => x.status === 'error').length;
    setStats({
      online: onl, offline: d.displays.length - onl - err, error: err, total: d.displays.length,
    });
    const a = await api.listAlerts(true);
    setAlerts(a.alerts);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const unsub = ws.subscribe(msg => {
      if (msg.type === 'alert' || msg.type === 'alert_dismiss' || msg.type === 'refresh') {
        load();
      }
    });
    const interval = setInterval(load, 30_000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Panorama general del sistema" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pantallas totales" value={stats.total} color="blue" icon="📺" />
        <StatCard label="En línea"          value={stats.online} color="green" icon="✅" />
        <StatCard label="Offline"           value={stats.offline} color="slate" icon="⚫" />
        <StatCard label="Alertas activas"   value={alerts.length} color="red" icon="🚨" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Estado de pantallas</h2>
          {displays.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin pantallas registradas. <Link to="/displays" className="text-brand-600">Crear una</Link>.</p>
          ) : (
            <table className="table-simple">
              <thead>
                <tr><th>Nombre</th><th>Zona</th><th>Estado</th><th>Última conexión</th></tr>
              </thead>
              <tbody>
                {displays.slice(0, 10).map(d => (
                  <tr key={d.id}>
                    <td><Link to={`/displays/${d.id}`} className="text-brand-700 hover:underline">{d.name}</Link></td>
                    <td>{d.zone_name ?? '—'}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="text-slate-500 text-sm">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('es-AR') : 'Nunca'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Alertas activas</h2>
          {alerts.length === 0 ? (
            <p className="text-slate-500 text-sm">No hay alertas activas.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.id} className={`p-3 rounded-lg border ${severityBg(a.severity)}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold">{a.title}</div>
                      {a.body && <div className="text-sm opacity-90">{a.body}</div>}
                      <div className="text-xs opacity-70 mt-1">
                        {a.target_type === 'all' ? 'Todas las pantallas' : `${a.target_type}: ${a.target_id}`}
                        {' · '}{new Date(a.created_at).toLocaleString('es-AR')}
                      </div>
                    </div>
                    <button onClick={() => api.dismissAlert(a.id).then(load)} className="btn-ghost text-xs">Cerrar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const colorMap: Record<string, string> = {
    blue:  'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    slate: 'from-slate-500 to-slate-600',
    red:   'from-red-500 to-red-600',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} text-white rounded-xl p-6 shadow-sm`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-white/80 text-sm">{label}</div>
          <div className="text-4xl font-bold mt-1">{value}</div>
        </div>
        <div className="text-3xl opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function severityBg(sev: string): string {
  return {
    emergency: 'bg-red-50 border-red-300 text-red-900',
    critical:  'bg-red-50 border-red-200 text-red-800',
    warn:      'bg-amber-50 border-amber-200 text-amber-800',
    info:      'bg-blue-50 border-blue-200 text-blue-800',
  }[sev] || 'bg-slate-50 border-slate-200';
}
