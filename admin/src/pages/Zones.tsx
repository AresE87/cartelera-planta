import { useEffect, useState } from 'react';
import { api, Zone, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

export default function Zones({ user }: { user: User }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [modal, setModal] = useState<{ open: boolean; zone?: Zone }>({ open: false });
  const [form, setForm] = useState({ name: '', description: '', color: '#3b82f6' });

  const canWrite = ['admin', 'comunicaciones'].includes(user.role);

  const load = () => api.listZones().then(r => setZones(r.zones));
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ name: '', description: '', color: '#3b82f6' });
    setModal({ open: true });
  };
  const openEdit = (z: Zone) => {
    setForm({ name: z.name, description: z.description ?? '', color: z.color });
    setModal({ open: true, zone: z });
  };
  const save = async () => {
    if (!form.name) return;
    if (modal.zone) await api.updateZone(modal.zone.id, form);
    else await api.createZone(form);
    setModal({ open: false });
    load();
  };
  const remove = async (z: Zone) => {
    if (!confirm(`¿Eliminar zona "${z.name}"?`)) return;
    await api.deleteZone(z.id);
    load();
  };

  return (
    <>
      <PageHeader title="Zonas" subtitle="Agrupación de pantallas por ubicación o área funcional"
        actions={canWrite && <button onClick={openNew} className="btn-primary">+ Nueva zona</button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map(z => (
          <div key={z.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg" style={{ background: z.color }} />
                <div>
                  <div className="font-semibold">{z.name}</div>
                  <div className="text-xs text-slate-500">{z.display_count ?? 0} pantallas</div>
                </div>
              </div>
              {canWrite && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(z)} className="btn-ghost text-xs">Editar</button>
                  {user.role === 'admin' && <button onClick={() => remove(z)} className="btn-ghost text-xs text-red-600">Borrar</button>}
                </div>
              )}
            </div>
            {z.description && <p className="text-sm text-slate-600">{z.description}</p>}
          </div>
        ))}
        {zones.length === 0 && <p className="col-span-full text-slate-500 text-center py-12">Sin zonas creadas.</p>}
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.zone ? 'Editar zona' : 'Nueva zona'}
        footer={<>
          <button onClick={() => setModal({ open: false })} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">Guardar</button>
        </>}
      >
        <div className="space-y-4">
          <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Descripción</label><textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Color</label><input type="color" className="h-10 w-20 rounded border" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
        </div>
      </Modal>
    </>
  );
}
