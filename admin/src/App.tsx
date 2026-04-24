import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api, User, setToken, getToken } from './lib/api';
import { ws } from './lib/ws';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Zones from './pages/Zones';
import Displays from './pages/Displays';
import DisplayDetail from './pages/DisplayDetail';
import Media from './pages/Media';
import Layouts from './pages/Layouts';
import LayoutEditor from './pages/LayoutEditor';
import Schedules from './pages/Schedules';
import Widgets from './pages/Widgets';
import WidgetEditor from './pages/WidgetEditor';
import Alerts from './pages/Alerts';
import Users from './pages/Users';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    api.me()
      .then(r => { setUser(r.user); ws.connect(); })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!user) ws.disconnect(); }, [user]);

  const handleLogin = (u: User) => {
    setUser(u);
    ws.connect();
    nav('/', { replace: true });
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    ws.disconnect();
    nav('/login', { replace: true });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-slate-500">Cargando...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/zones" element={<Zones user={user} />} />
        <Route path="/displays" element={<Displays user={user} />} />
        <Route path="/displays/:id" element={<DisplayDetail user={user} />} />
        <Route path="/media" element={<Media user={user} />} />
        <Route path="/layouts" element={<Layouts user={user} />} />
        <Route path="/layouts/:id" element={<LayoutEditor user={user} />} />
        <Route path="/schedules" element={<Schedules user={user} />} />
        <Route path="/widgets" element={<Widgets user={user} />} />
        <Route path="/widgets/:id" element={<WidgetEditor user={user} />} />
        <Route path="/alerts" element={<Alerts user={user} />} />
        <Route path="/users" element={<Users user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
