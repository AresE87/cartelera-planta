import { useEffect, useState } from 'react';
import { api, Schedule, Layout, Zone, Display, User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function Schedules({ user }: { user: User }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [displays, setDisplays] = useState<Display[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', layout_id: 0, target: 'zone', zone_id: 0, display_id: 0,
    days_of_week: '1,2,3,4,5', start_time: '', end_time: '',
    starts_at: '', ends_at: '', priority: 10, active: true,
  });

  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  const load = async () => {
    const [s, l, z, d] = await Promise.all([
      api.listSchedules(),
      api.listLayouts(),
      api.listZones(),
      api.listDisplays(),
    ]);
    setSchedules(s.schedules);
    setLayouts(l.layouts);
    setZones(z.zones);
    setDisplays(d.displays);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const payload: any = {
      name: form.name,
      layout_id: form.layout_id,
      priority: form.priority,
      active: form.active,
    };
    if (form.target === 'zone') payload.zone_id = form.zone_id || null;
    if (form.target === 'display') payload.display_id = form.display_id || null;
    if (form.starts_at) payload.starts_at = new Date(form.starts_at).toISOString();
    if (form.ends_at) payload.ends_at = new Date(form.ends_at).toISOString();
    if (form.days_of_week) payload.days_of_week = form.days_of_week;
    if (form.start_time) payload.start_time = form.start_time;
    if (form.end_time) payload.end_time = form.end_time;
    await api.createSchedule(payload);
    setModal(false);
    load();
  };

  const toggle = async (s: Schedule) => {
    await api.updateSchedule(s.id, { active: !s.active });
    load();
  };

  return (
    <>
      <PageHeader title="Programación" subtitle="Cuándo y dónde se muestra cada layout"
        actions={canWrite && <button onClick={() => setModal(true)} className="btn-primary">+ Nueva programación</button>} />

      <div className="card overflow-x-auto">
        <table className="table-simple">
          <thead>
            <tr><th>Nombre</th><th>Layout</th><th>Objetivo</th><th>Cuándo</th><th>Prioridad</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {schedules.map(s => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td>{s.layout_name ?? '—'}</td>
                <td>
                  {s.display_name ? `Pantalla: ${s.display_name}` : s.zone_name ? `Zona: ${s.zone_name}` : 'Todos'}
                </td>
                <td className="text-xs text-slate-600">
                  {s.days_of_week && <div>{s.days_of_week.split(',').map(d => DOW[Number(d)]).join(', ')}</div>}
                  {(s.start_time || s.end_time) && <div>{s.start_time || '00:00'} - {s.end_time || '23:59'}</div>}
                  {s.starts_at && <div>Desde: {new Date(s.starts_at).toLocaleDateString('es-AR')}</div>}
                  {s.ends_at && <div>Hasta: {new Date(s.ends_at).toLocaleDateString('es-AR')}</div>}
                </td>
                <td>{s.priority}</td>
                <td>
                  <button onClick={() => canWrite && toggle(s)} className={`badge ${s.active ? 'badge-online' : 'badge-offline'}`}>
                    {s.active ? 'Activo' : 'Pausado'}
                  </button>
                </td>
                <td className="text-right">
                  {canWrite && <button onClick={() => confirm(`¿Eliminar "${s.name}"?`) && api.deleteSchedule(s.id).then(load)} className="btn-ghost text-xs text-red-600">Borrar</button>}
                </td>
              </tr>
            ))}
            {schedules.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">Sin programaciones.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva programación" size="lg"
        footer={<><button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button><button onClick={create} className="btn-primary" disabled={!form.name || !form.layout_id}>Crear</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Horario de almuerzo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Layout</label>
              <select className="input" value={form.layout_id} onChange={e => setForm({ ...form, layout_id: Number(e.target.value) })}>
                <option value={0}>— seleccionar —</option>
                {layouts.filter(l => l.published).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioridad</label>
              <input type="number" min={0} max={100} className="input" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <label className="label">Aplicar a</label>
            <div className="flex gap-4">
              <label><input type="radio" checked={form.target === 'zone'} onChange={() => setForm({ ...form, target: 'zone' })} /> Zona</label>
              <label><input type="radio" checked={form.target === 'display'} onChange={() => setForm({ ...form, target: 'display' })} /> Pantalla específica</label>
            </div>
          </div>

          {form.target === 'zone' && (
            <div>
              <label className="label">Zona</label>
              <select className="input" value={form.zone_id} onChange={e => setForm({ ...form, zone_id: Number(e.target.value) })}>
                <option value={0}>— seleccionar —</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          )}
          {form.target === 'display' && (
            <div>
              <label className="label">Pantalla</label>
              <select className="input" value={form.display_id} onChange={e => setForm({ ...form, display_id: Number(e.target.value) })}>
                <option value={0}>— seleccionar —</option>
                {displays.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Días de la semana</label>
            <div className="flex gap-2">
              {DOW.map((d, i) => {
                const active = form.days_of_week.split(',').includes(String(i));
                return (
                  <button key={i} type="button"
                    onClick={() => {
                      const set = new Set(form.days_of_week.split(',').filter(Boolean));
                      active ? set.delete(String(i)) : set.add(String(i));
                      setForm({ ...form, days_of_week: Array.from(set).sort().join(',') });
                    }}
                    className={`px-3 py-1 rounded text-sm ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Hora inicio</label><input type="time" className="input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
            <div><label className="label">Hora fin</label><input type="time" className="input" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Desde (fecha)</label><input type="datetime-local" className="input" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><label className="label">Hasta (fecha)</label><input type="datetime-local" className="input" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
        </div>
      </Modal>
    </>
  );
}
