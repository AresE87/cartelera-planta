import { useEffect, useState } from 'react';
import { api, User as UserT, Role } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'comunicaciones', label: 'Comunicaciones' },
  { value: 'rrhh', label: 'RRHH' },
  { value: 'produccion', label: 'Producción' },
  { value: 'seguridad', label: 'Seguridad / HSE' },
  { value: 'operator', label: 'Operador (solo lectura)' },
];

export default function Users({ user }: { user: UserT }) {
  const [users, setUsers] = useState<UserT[]>([]);
  const [modal, setModal] = useState<{ open: boolean; user?: UserT }>({ open: false });
  const [form, setForm] = useState({ email: '', name: '', role: 'operator' as Role, password: '', active: true });

  if (user.role !== 'admin') {
    return <div className="text-slate-600">Solo administradores pueden gestionar usuarios.</div>;
  }

  const load = () => api.listUsers().then(r => setUsers(r.users));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ email: '', name: '', role: 'operator', password: '', active: true }); setModal({ open: true }); };
  const openEdit = (u: UserT) => { setForm({ email: u.email, name: u.name, role: u.role, password: '', active: Boolean(u.active) }); setModal({ open: true, user: u }); };

  const save = async () => {
    if (modal.user) {
      const patch: any = { name: form.name, role: form.role, active: form.active };
      if (form.password) patch.password = form.password;
      await api.updateUser(modal.user.id, patch);
    } else {
      await api.createUser({ email: form.email, name: form.name, role: form.role, password: form.password });
    }
    setModal({ open: false });
    load();
  };

  const remove = async (u: UserT) => {
    if (!confirm(`¿Eliminar ${u.email}?`)) return;
    await api.deleteUser(u.id);
    load();
  };

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Gestión de accesos al panel"
        actions={<button onClick={openNew} className="btn-primary">+ Nuevo usuario</button>} />

      <div className="card overflow-x-auto">
        <table className="table-simple">
          <thead><tr><th>Email</th><th>Nombre</th><th>Rol</th><th>Último login</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="font-mono text-sm">{u.email}</td>
                <td>{u.name}</td>
                <td><span className="badge bg-slate-100 text-slate-700">{u.role}</span></td>
                <td className="text-xs text-slate-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-AR') : 'Nunca'}</td>
                <td>{u.active ? <span className="badge badge-online">Activo</span> : <span className="badge badge-offline">Deshabilitado</span>}</td>
                <td className="text-right">
                  <button onClick={() => openEdit(u)} className="btn-ghost text-xs">Editar</button>
                  {u.id !== user.id && <button onClick={() => remove(u)} className="btn-ghost text-xs text-red-600">Borrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.user ? 'Editar usuario' : 'Nuevo usuario'}
        footer={<><button onClick={() => setModal({ open: false })} className="btn-secondary">Cancelar</button><button onClick={save} className="btn-primary">Guardar</button></>}>
        <div className="space-y-4">
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={!!modal.user} /></div>
          <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{modal.user ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
            <input type="password" className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={8} />
          </div>
          {modal.user && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              Activo
            </label>
          )}
        </div>
      </Modal>
    </>
  );
}
