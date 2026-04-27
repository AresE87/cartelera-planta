import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Alert, Display, Layout, Media, Schedule, Widget, Zone } from '../lib/api';
import { ws } from '../lib/ws';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [d, a, l, m, w, s, z] = await Promise.all([
        api.listDisplays(),
        api.listAlerts(true),
        api.listLayouts(),
        api.listMedia(),
        api.listWidgets(),
        api.listSchedules({ active: true }),
        api.listZones(),
      ]);
      setDisplays(d.displays);
      setAlerts(a.alerts);
      setLayouts(l.layouts);
      setMedia(m.media);
      setWidgets(w.widgets);
      setSchedules(s.schedules);
      setZones(z.zones);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar el panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const unsub = ws.subscribe(msg => {
      if (['alert', 'alert_dismiss', 'refresh', 'layout_change'].includes(msg.type)) load();
    });
    const interval = setInterval(load, 30_000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  const stats = useMemo(() => {
    const online = displays.filter(x => x.status === 'online').length;
    const errorCount = displays.filter(x => x.status === 'error').length;
    const pending = displays.filter(x => !!x.pairing_code).length;
    return {
      total: displays.length,
      online,
      offline: displays.length - online - errorCount,
      error: errorCount,
      pending,
    };
  }, [displays]);

  const nextActions = [
    { title: 'Conectar TV', value: `${stats.pending} pendientes`, to: '/displays', tone: stats.pending ? 'amber' : 'slate' },
    { title: 'Contenido', value: `${layouts.length} layouts`, to: '/layouts', tone: layouts.length ? 'blue' : 'amber' },
    { title: 'Archivos', value: `${media.length} media`, to: '/media', tone: media.length ? 'blue' : 'slate' },
    { title: 'Horarios', value: `${schedules.length} activos`, to: '/schedules', tone: schedules.length ? 'green' : 'slate' },
  ];

  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Estado operativo de pantallas, contenido y alertas"
        actions={<>
          <Link to="/alerts" className="btn-danger">Enviar alerta</Link>
          <Link to="/displays" className="btn-primary">Nueva pantalla</Link>
        </>}
      />

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pantallas" value={stats.total} detail={`${stats.online} online`} tone="blue" />
        <StatCard label="Online" value={stats.online} detail={`${stats.offline} offline`} tone="green" />
        <StatCard label="Pairing" value={stats.pending} detail="codigos activos" tone={stats.pending ? 'amber' : 'slate'} />
        <StatCard label="Alertas" value={alerts.length} detail="activas ahora" tone={alerts.length ? 'red' : 'slate'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {nextActions.map(action => (
              <Link key={action.title} to={action.to} className={`rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${toneCard(action.tone)}`}>
                <div className="text-xs uppercase tracking-wide opacity-70">{action.title}</div>
                <div className="mt-1 text-xl font-semibold">{action.value}</div>
              </Link>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Pantallas</h2>
              <Link to="/displays" className="btn-ghost text-sm">Ver todas</Link>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : displays.length === 0 ? (
              <Empty text="Todavia no hay pantallas registradas." action="Crear pantalla" to="/displays" />
            ) : (
              <table className="table-simple">
                <thead>
                  <tr><th>Nombre</th><th>Zona</th><th>Estado</th><th>Contenido</th><th>Ultima conexion</th></tr>
                </thead>
                <tbody>
                  {displays.slice(0, 8).map(d => (
                    <tr key={d.id}>
                      <td><Link to={`/displays/${d.id}`} className="font-medium text-brand-700 hover:underline">{d.name}</Link></td>
                      <td>{d.zone_name ?? 'Sin zona'}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td className="text-sm text-slate-600">{d.current_layout_name ?? 'Sin layout'}</td>
                      <td className="text-sm text-slate-500">{d.last_seen_at ? relTime(d.last_seen_at) : 'Nunca'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Inventario</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Inventory label="Zonas" value={zones.length} to="/zones" />
              <Inventory label="Layouts" value={layouts.length} to="/layouts" />
              <Inventory label="Widgets" value={widgets.length} to="/widgets" />
              <Inventory label="Media" value={media.length} to="/media" />
            </div>
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Alertas activas</h2>
              <Link to="/alerts" className="btn-ghost text-sm">Gestionar</Link>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">Sin alertas activas.</p>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 5).map(a => (
                  <div key={a.id} className={`rounded-lg border p-3 ${severityBg(a.severity)}`}>
                    <div className="font-semibold">{a.title}</div>
                    {a.body && <div className="text-sm opacity-90">{a.body}</div>}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs opacity-80">
                      <span>{targetLabel(a)}</span>
                      <button onClick={() => api.dismissAlert(a.id).then(load)} className="underline">Cerrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function StatCard({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return (
    <div className={`rounded-lg border p-5 ${toneCard(tone)}`}>
      <div className="text-sm opacity-75">{label}</div>
      <div className="mt-1 text-4xl font-bold">{value}</div>
      <div className="mt-1 text-xs opacity-70">{detail}</div>
    </div>
  );
}

function Inventory({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-brand-300 hover:bg-brand-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
    </Link>
  );
}

function Empty({ text, action, to }: { text: string; action: string; to: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="mb-3 text-sm text-slate-500">{text}</p>
      <Link to={to} className="btn-primary">{action}</Link>
    </div>
  );
}

function toneCard(tone: string): string {
  return {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    slate: 'border-slate-200 bg-white text-slate-900',
  }[tone] || 'border-slate-200 bg-white text-slate-900';
}

function severityBg(sev: string): string {
  return {
    emergency: 'bg-red-50 border-red-300 text-red-900',
    critical: 'bg-red-50 border-red-200 text-red-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }[sev] || 'bg-slate-50 border-slate-200';
}

function targetLabel(a: Alert): string {
  if (a.target_type === 'all') return 'Todas las pantallas';
  if (a.target_type === 'zone') return `Zona ${a.target_id}`;
  return `Pantalla ${a.target_id}`;
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
