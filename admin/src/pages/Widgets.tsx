import { useEffect, useState } from 'react';
import { api, Widget, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Link, useNavigate } from 'react-router-dom';

const WIDGET_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'beneficios', label: 'Beneficios',  icon: '🎁' },
  { value: 'cumpleanos', label: 'Cumpleaños',  icon: '🎂' },
  { value: 'avisos',     label: 'Avisos',      icon: '📣' },
  { value: 'kpis',       label: 'KPIs',        icon: '📊' },
  { value: 'alertas',    label: 'Alertas',     icon: '⚠️' },
  { value: 'clima',      label: 'Clima',       icon: '🌤️' },
  { value: 'reloj',      label: 'Reloj',       icon: '🕐' },
  { value: 'rss',        label: 'RSS',         icon: '📰' },
  { value: 'texto',      label: 'Texto',       icon: '📝' },
  { value: 'imagen_url', label: 'Imagen URL',  icon: '🖼' },
  { value: 'youtube',    label: 'YouTube',     icon: '▶' },
  { value: 'iframe',     label: 'Iframe',      icon: '🌐' },
];

export default function Widgets({ user }: { user: User }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [modal, setModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [name, setName] = useState('');
  const nav = useNavigate();
  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  const load = () => api.listWidgets().then(r => setWidgets(r.widgets));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!selectedType || !name) return;
    const r = await api.createWidget({
      type: selectedType as any,
      name,
      config: defaultConfig(selectedType),
      refresh_seconds: defaultRefresh(selectedType),
    });
    setModal(false);
    setName('');
    setSelectedType('');
    nav(`/widgets/${r.id}`);
  };

  return (
    <>
      <PageHeader title="Widgets" subtitle="Componentes dinámicos que se alimentan de datos"
        actions={canWrite && <button onClick={() => setModal(true)} className="btn-primary">+ Nuevo widget</button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map(w => {
          const typeInfo = WIDGET_TYPES.find(t => t.value === w.type);
          return (
            <div key={w.id} className="card hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{typeInfo?.icon ?? '🧩'}</div>
                <div className="flex-1 min-w-0">
                  <Link to={`/widgets/${w.id}`} className="font-semibold hover:text-brand-700 block truncate">{w.name}</Link>
                  <div className="text-xs text-slate-500">{typeInfo?.label ?? w.type} · refresh {w.refresh_seconds}s</div>
                  {w.cached_at && <div className="text-xs text-slate-400 mt-1">Cache: {new Date(w.cached_at).toLocaleString('es-AR')}</div>}
                </div>
                {canWrite && (
                  <div className="flex flex-col gap-1">
                    <button onClick={() => api.refreshWidget(w.id).then(load)} className="btn-ghost text-xs">⟳ Refresh</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {widgets.length === 0 && <p className="col-span-full text-slate-500 text-center py-12">Sin widgets. Creá uno para empezar.</p>}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo widget"
        footer={<><button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button><button onClick={create} className="btn-primary" disabled={!selectedType || !name}>Crear y editar</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {WIDGET_TYPES.map(t => (
                <button key={t.value} onClick={() => setSelectedType(t.value)}
                  className={`p-3 border rounded-lg text-center hover:bg-slate-50 ${selectedType === t.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                  <div className="text-2xl">{t.icon}</div>
                  <div className="text-xs mt-1">{t.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Beneficios de abril" />
          </div>
        </div>
      </Modal>
    </>
  );
}

function defaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case 'beneficios': return { source: 'static', items: [] };
    case 'cumpleanos': return { source: 'static', people: [] };
    case 'avisos':     return { source: 'static', items: [] };
    case 'kpis':       return { source: 'static', layout: 'grid', kpis: [] };
    case 'alertas':    return { targetType: 'all' };
    case 'clima':      return { lat: -34.6, lon: -58.38, nombre: 'Buenos Aires' };
    case 'reloj':      return { formato: '24h', mostrarFecha: true };
    case 'rss':        return { url: '' };
    case 'texto':      return { texto: '', alineacion: 'center' };
    case 'imagen_url': return { url: '', fit: 'cover' };
    case 'youtube':    return { videoId: '', mute: true, autoplay: true };
    case 'iframe':     return { url: '' };
    default: return {};
  }
}

function defaultRefresh(type: string): number {
  switch (type) {
    case 'reloj': return 3600;
    case 'clima': return 900;
    case 'kpis':  return 60;
    case 'alertas': return 30;
    default: return 300;
  }
}
