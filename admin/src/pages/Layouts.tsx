import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, Layout, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

const PRESETS = [
  { key: 'fhd', name: 'Full HD horizontal', width: 1920, height: 1080, note: 'Recomendado para la mayoria de TVs' },
  { key: '4k', name: '4K horizontal', width: 3840, height: 2160, note: 'TVs modernas con contenido pesado' },
  { key: 'hd', name: 'HD liviano', width: 1280, height: 720, note: 'Pantallas antiguas o demo' },
  { key: 'vertical', name: 'Vertical', width: 1080, height: 1920, note: 'Totems o pantallas rotadas' },
];

export default function Layouts({ user }: { user: User }) {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [modal, setModal] = useState(false);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [form, setForm] = useState({ name: '', description: '' });
  const nav = useNavigate();
  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  const load = () => api.listLayouts().then(r => setLayouts(r.layouts));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return;
    const r = await api.createLayout({
      name: form.name,
      description: form.description,
      width: preset.width,
      height: preset.height,
      background_color: '#10245f',
      definition: starterDefinition(preset.width, preset.height),
      published: true,
    });
    setModal(false);
    setForm({ name: '', description: '' });
    nav(`/layouts/${r.id}`);
  };

  return (
    <>
      <PageHeader
        title="Layouts"
        subtitle="Plantillas visuales que despues se asignan a pantallas o zonas"
        actions={canWrite && <button onClick={() => setModal(true)} className="btn-primary">Nuevo layout</button>}
      />

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Summary label="Layouts" value={layouts.length} />
        <Summary label="Publicados" value={layouts.filter(l => !!l.published).length} />
        <Summary label="Borradores" value={layouts.filter(l => !l.published).length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {layouts.map(l => (
          <div key={l.id} className="card hover:shadow-md transition">
            <Link to={`/layouts/${l.id}`} className="block">
              <div className="aspect-video overflow-hidden rounded-lg bg-slate-900 p-3">
                <div className="h-full w-full rounded border border-white/20 bg-gradient-to-br from-blue-900 to-slate-950">
                  <div className="h-1/4 border-b border-white/10" />
                  <div className="grid h-3/4 grid-cols-3 gap-2 p-3">
                    <div className="col-span-2 rounded bg-white/10" />
                    <div className="rounded bg-white/10" />
                  </div>
                </div>
              </div>
            </Link>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/layouts/${l.id}`} className="block truncate font-semibold hover:text-brand-700">{l.name}</Link>
                <div className="text-xs text-slate-500">{l.width} x {l.height}</div>
                <div className="mt-2">
                  {l.published ? <span className="badge badge-online">Publicado</span> : <span className="badge badge-paused">Borrador</span>}
                </div>
              </div>
              {canWrite && (
                <div className="flex flex-col gap-1">
                  <button onClick={() => api.duplicateLayout(l.id).then(load)} className="btn-ghost text-xs">Duplicar</button>
                  {user.role === 'admin' && <button onClick={() => confirm(`Borrar "${l.name}"?`) && api.deleteLayout(l.id).then(load)} className="btn-ghost text-xs text-red-600">Borrar</button>}
                </div>
              )}
            </div>
          </div>
        ))}
        {layouts.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">No hay layouts</div>
            {canWrite && <button onClick={() => setModal(true)} className="btn-primary mt-4">Crear layout</button>}
          </div>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nuevo layout"
        footer={<>
          <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
          <button onClick={create} className="btn-primary" disabled={!form.name}>Crear y editar</button>
        </>}
      >
        <div className="space-y-5">
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Comedor principal - turno manana" />
          </div>
          <div>
            <label className="label">Formato</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button key={p.key} onClick={() => setPreset(p)} className={`rounded-lg border p-3 text-left hover:bg-slate-50 ${preset.key === p.key ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.width} x {p.height} · {p.note}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Descripcion</label>
            <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Uso interno del layout" />
          </div>
        </div>
      </Modal>
    </>
  );
}

function starterDefinition(width: number, height: number) {
  return {
    regions: [
      {
        id: 'header',
        name: 'Titulo',
        x: Math.round(width * 0.05),
        y: Math.round(height * 0.06),
        w: Math.round(width * 0.9),
        h: Math.round(height * 0.18),
        items: [{ type: 'text', text: 'Cartelera Planta', durationMs: 10000 }],
      },
      {
        id: 'main',
        name: 'Contenido principal',
        x: Math.round(width * 0.08),
        y: Math.round(height * 0.3),
        w: Math.round(width * 0.84),
        h: Math.round(height * 0.42),
        items: [{ type: 'text', text: 'Nuevo contenido', durationMs: 10000 }],
      },
      {
        id: 'footer',
        name: 'Pie',
        x: Math.round(width * 0.08),
        y: Math.round(height * 0.8),
        w: Math.round(width * 0.84),
        h: Math.round(height * 0.12),
        items: [{ type: 'text', text: 'Avisos y novedades', durationMs: 10000 }],
      },
    ],
  };
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
