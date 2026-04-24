import { useEffect, useState } from 'react';
import { api, Layout, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Link, useNavigate } from 'react-router-dom';

export default function Layouts({ user }: { user: User }) {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', width: 1920, height: 1080 });
  const nav = useNavigate();
  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  const load = () => api.listLayouts().then(r => setLayouts(r.layouts));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return;
    const r = await api.createLayout({
      ...form,
      background_color: '#0f172a',
      definition: {
        regions: [
          { id: 'main', name: 'Región principal', x: 0, y: 0, w: form.width, h: form.height, items: [
            { type: 'text', text: 'Nuevo layout — editá las regiones', durationMs: 10000 },
          ] },
        ],
      },
    });
    setModal(false);
    nav(`/layouts/${r.id}`);
  };

  return (
    <>
      <PageHeader title="Layouts" subtitle="Composición de pantallas con regiones y widgets"
        actions={canWrite && <button onClick={() => setModal(true)} className="btn-primary">+ Nuevo layout</button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {layouts.map(l => (
          <div key={l.id} className="card hover:shadow-md">
            <div className="aspect-video bg-slate-800 rounded mb-3 flex items-center justify-center text-white/50 text-xs">
              {l.width} × {l.height}
            </div>
            <div className="flex justify-between items-start">
              <div>
                <Link to={`/layouts/${l.id}`} className="font-semibold hover:text-brand-700">{l.name}</Link>
                <div className="text-xs text-slate-500">{l.description ?? '—'}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {l.published ? <span className="badge badge-online">Publicado</span> : <span className="badge badge-paused">Borrador</span>}
                  {' '}·{' '}{new Date(l.updated_at).toLocaleDateString('es-AR')}
                </div>
              </div>
              {canWrite && (
                <div className="flex flex-col gap-1">
                  <button onClick={() => api.duplicateLayout(l.id).then(load)} className="btn-ghost text-xs">Duplicar</button>
                  {user.role === 'admin' && <button onClick={() => confirm(`¿Borrar "${l.name}"?`) && api.deleteLayout(l.id).then(load)} className="btn-ghost text-xs text-red-600">Borrar</button>}
                </div>
              )}
            </div>
          </div>
        ))}
        {layouts.length === 0 && <p className="col-span-full text-slate-500 text-center py-12">Sin layouts. Creá uno para empezar.</p>}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo layout"
        footer={<><button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button><button onClick={create} className="btn-primary">Crear y editar</button></>}>
        <div className="space-y-4">
          <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Descripción</label><input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Ancho (px)</label><input type="number" className="input" value={form.width} onChange={e => setForm({ ...form, width: Number(e.target.value) })} /></div>
            <div><label className="label">Alto (px)</label><input type="number" className="input" value={form.height} onChange={e => setForm({ ...form, height: Number(e.target.value) })} /></div>
          </div>
        </div>
      </Modal>
    </>
  );
}
