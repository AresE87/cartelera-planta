import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { User } from '../lib/api';

interface Props {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}

const NAV_GROUPS: { title: string; items: { to: string; label: string; hint: string; icon: string; roles?: string[] }[] }[] = [
  {
    title: 'Operacion',
    items: [
      { to: '/',          label: 'Inicio',     hint: 'estado general', icon: '●' },
      { to: '/displays',  label: 'Pantallas',  hint: 'tvs y pairing',  icon: '▣' },
      { to: '/alerts',    label: 'Alertas',    hint: 'avisos urgentes', icon: '!' },
    ],
  },
  {
    title: 'Contenido',
    items: [
      { to: '/layouts',   label: 'Layouts',      hint: 'plantillas', icon: '▦' },
      { to: '/media',     label: 'Media',        hint: 'imagenes y video', icon: '▧' },
      { to: '/widgets',   label: 'Widgets',      hint: 'datos vivos', icon: '◇' },
      { to: '/schedules', label: 'Programacion', hint: 'horarios', icon: '◷' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/zones', label: 'Zonas', hint: 'sectores', icon: '⌖' },
      { to: '/users', label: 'Usuarios', hint: 'accesos', icon: '◎', roles: ['admin'] },
    ],
  },
];

export default function Layout({ user, onLogout, children }: Props) {
  const location = useLocation();
  const current = NAV_GROUPS.flatMap(g => g.items).find(item =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  );

  return (
    <div className="flex h-full bg-slate-100">
      <aside className="w-72 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-lg font-bold">TV</span>
            <div>
              <div className="font-bold text-lg leading-tight">Cartelera Planta</div>
              <div className="text-xs text-slate-400">Panel de administracion</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-5">
          {NAV_GROUPS.map(group => {
            const items = group.items.filter(i => !i.roles || i.roles.includes(user.role));
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="px-3 mb-2 text-[11px] uppercase tracking-wide text-slate-500">{group.title}</div>
                <div className="space-y-1">
                  {items.map(item => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      <span className="grid h-7 w-7 place-items-center rounded bg-white/5 text-sm">{item.icon}</span>
                      <span className="min-w-0">
                        <span className="block leading-tight">{item.label}</span>
                        <span className="block truncate text-xs text-slate-400">{item.hint}</span>
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="rounded-lg bg-white/5 p-3 text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="text-slate-400 text-xs truncate">{user.email}</div>
            <div className="mt-2">
              <span className="badge bg-slate-700 text-slate-300">{user.role}</span>
            </div>
          </div>
          <button onClick={onLogout} className="mt-3 w-full text-left nav-link text-slate-400 hover:text-white">
            <span>↪</span> Cerrar sesion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-8 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Estas en</div>
              <div className="font-semibold text-slate-900">{current?.label ?? 'Cartelera'}</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <a href="/display/" target="_blank" rel="noreferrer" className="btn-secondary py-1.5">Abrir display</a>
              <span className="hidden rounded bg-slate-100 px-2 py-1 text-xs text-slate-500 md:inline">{window.location.origin}</span>
            </div>
          </div>
        </div>
        <div className="p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
