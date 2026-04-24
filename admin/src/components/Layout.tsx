import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { User } from '../lib/api';

interface Props {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}

const NAV_ITEMS: { to: string; label: string; icon: string; roles?: string[] }[] = [
  { to: '/',          label: 'Dashboard',  icon: '🏠' },
  { to: '/displays',  label: 'Pantallas',  icon: '📺' },
  { to: '/zones',     label: 'Zonas',      icon: '🗺️' },
  { to: '/layouts',   label: 'Layouts',    icon: '🎨' },
  { to: '/media',     label: 'Media',      icon: '🖼️' },
  { to: '/widgets',   label: 'Widgets',    icon: '🧩' },
  { to: '/schedules', label: 'Programación', icon: '📅' },
  { to: '/alerts',    label: 'Alertas',    icon: '🚨' },
  { to: '/users',     label: 'Usuarios',   icon: '👥', roles: ['admin'] },
];

export default function Layout({ user, onLogout, children }: Props) {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📺</span>
            <div>
              <div className="font-bold text-lg leading-tight">Cartelera</div>
              <div className="text-xs text-slate-400">Planta</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.filter(i => !i.roles || i.roles.includes(user.role)).map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="text-slate-400 text-xs">{user.email}</div>
            <div className="mt-1">
              <span className="badge bg-slate-700 text-slate-300">{user.role}</span>
            </div>
          </div>
          <button onClick={onLogout} className="mt-3 w-full text-left nav-link text-slate-400 hover:text-white">
            <span>↪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
