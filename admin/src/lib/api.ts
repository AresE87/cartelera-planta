const TOKEN_KEY = 'cartelera.admin.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

const BASE = '';  // relative; proxied in dev, same-origin in prod

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(opts.body && !(opts.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
    ...(token ? { authorization: 'Bearer ' + token } : {}),
    ...(opts.headers as Record<string, string> || {}),
  };
  const res = await fetch(BASE + path, { ...opts, headers });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    const msg = (data as any)?.error || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, (data as any)?.details);
  }
  return data as T;
}

export const api = {
  // auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me:    () => request<{ user: User }>('/api/auth/me'),

  // users
  listUsers:   () => request<{ users: User[] }>('/api/users'),
  createUser:  (data: Partial<User> & { password: string }) =>
    request<{ id: number }>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser:  (id: number, data: Partial<User> & { password?: string }) =>
    request<{ ok: boolean }>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser:  (id: number) => request<{ ok: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),

  // zones
  listZones:  () => request<{ zones: Zone[] }>('/api/zones'),
  getZone:    (id: number) => request<{ zone: Zone; displays: Display[] }>(`/api/zones/${id}`),
  createZone: (data: Partial<Zone>) => request<{ id: number }>('/api/zones', { method: 'POST', body: JSON.stringify(data) }),
  updateZone: (id: number, data: Partial<Zone>) => request<{ ok: boolean }>(`/api/zones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteZone: (id: number) => request<{ ok: boolean }>(`/api/zones/${id}`, { method: 'DELETE' }),

  // displays
  listDisplays:   () => request<{ displays: Display[] }>('/api/displays'),
  getDisplay:     (id: number) => request<{ display: Display; heartbeats: any[] }>(`/api/displays/${id}`),
  createDisplay:  (data: Partial<Display>) => request<{ id: number; pairing_code: string }>('/api/displays', { method: 'POST', body: JSON.stringify(data) }),
  updateDisplay:  (id: number, data: Partial<Display>) => request<{ ok: boolean }>(`/api/displays/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDisplay:  (id: number) => request<{ ok: boolean }>(`/api/displays/${id}`, { method: 'DELETE' }),
  regeneratePairing: (id: number) => request<{ pairing_code: string }>(`/api/displays/${id}/regenerate-pairing`, { method: 'POST' }),
  setLayout:      (id: number, layout_id: number) => request<{ ok: boolean }>(`/api/displays/${id}/set-layout`, { method: 'POST', body: JSON.stringify({ layout_id }) }),
  reloadDisplay:  (id: number) => request<{ ok: boolean }>(`/api/displays/${id}/reload`, { method: 'POST' }),

  // media
  listMedia:  () => request<{ media: Media[] }>('/api/media'),
  uploadMedia: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ id: number; filename: string; url: string }>('/api/media/upload', { method: 'POST', body: fd });
  },
  deleteMedia: (id: number) => request<{ ok: boolean }>(`/api/media/${id}`, { method: 'DELETE' }),

  // layouts
  listLayouts: () => request<{ layouts: Layout[] }>('/api/layouts'),
  getLayout:   (id: number) => request<{ layout: Layout }>(`/api/layouts/${id}`),
  createLayout: (data: Partial<Layout>) => request<{ id: number }>('/api/layouts', { method: 'POST', body: JSON.stringify(data) }),
  updateLayout: (id: number, data: Partial<Layout>) => request<{ ok: boolean }>(`/api/layouts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLayout: (id: number) => request<{ ok: boolean }>(`/api/layouts/${id}`, { method: 'DELETE' }),
  duplicateLayout: (id: number) => request<{ id: number }>(`/api/layouts/${id}/duplicate`, { method: 'POST' }),

  // schedules
  listSchedules: (params?: { zone_id?: number; display_id?: number; active?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.zone_id) q.set('zone_id', String(params.zone_id));
    if (params?.display_id) q.set('display_id', String(params.display_id));
    if (params?.active !== undefined) q.set('active', String(params.active));
    const qs = q.toString();
    return request<{ schedules: Schedule[] }>(`/api/schedules${qs ? '?' + qs : ''}`);
  },
  createSchedule: (data: Partial<Schedule>) => request<{ id: number }>('/api/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id: number, data: Partial<Schedule>) => request<{ ok: boolean }>(`/api/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSchedule: (id: number) => request<{ ok: boolean }>(`/api/schedules/${id}`, { method: 'DELETE' }),

  // widgets
  listWidgets:   () => request<{ widgets: Widget[] }>('/api/widgets'),
  getWidget:     (id: number) => request<{ widget: any }>(`/api/widgets/${id}`),
  createWidget:  (data: Partial<Widget> & { config: Record<string, unknown> }) => request<{ id: number }>('/api/widgets', { method: 'POST', body: JSON.stringify(data) }),
  updateWidget:  (id: number, data: Partial<Widget> & { config?: Record<string, unknown> }) => request<{ ok: boolean }>(`/api/widgets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWidget:  (id: number) => request<{ ok: boolean }>(`/api/widgets/${id}`, { method: 'DELETE' }),
  refreshWidget: (id: number) => request<any>(`/api/widgets/${id}/refresh`, { method: 'POST' }),
  getWidgetData: (id: number) => request<any>(`/api/widgets/${id}/data`),

  // alerts
  listAlerts:     (active?: boolean) => {
    const q = active !== undefined ? '?active=' + active : '';
    return request<{ alerts: Alert[] }>(`/api/alerts${q}`);
  },
  sendAlert:      (data: Partial<Alert>) => request<{ id: number; alert: Alert }>('/api/alerts', { method: 'POST', body: JSON.stringify(data) }),
  dismissAlert:   (id: number) => request<{ ok: boolean }>(`/api/alerts/${id}/dismiss`, { method: 'POST' }),
};

// ---- Types (mirror backend) ----
export type Role = 'admin' | 'rrhh' | 'produccion' | 'seguridad' | 'comunicaciones' | 'operator';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active?: number;
  last_login_at?: string | null;
  created_at?: string;
}

export interface Zone {
  id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
  color: string;
  display_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Display {
  id: number;
  zone_id: number | null;
  zone_name?: string;
  name: string;
  description: string | null;
  pairing_code: string | null;
  pairing_expires_at: string | null;
  status: 'offline' | 'online' | 'error' | 'paused';
  last_seen_at: string | null;
  resolution: string;
  orientation: 'landscape' | 'portrait';
  current_layout_id: number | null;
  current_layout_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Media {
  id: number;
  type: 'image' | 'video' | 'html' | 'audio';
  filename: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface Layout {
  id: number;
  name: string;
  description: string | null;
  width: number;
  height: number;
  background_color: string;
  definition: any;
  published: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  layout_id: number;
  layout_name?: string;
  zone_id: number | null;
  zone_name?: string | null;
  display_id: number | null;
  display_name?: string | null;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  days_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  priority: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Widget {
  id: number;
  type: string;
  name: string;
  description: string | null;
  config?: Record<string, unknown>;
  data_source_url?: string | null;
  refresh_seconds: number;
  cached_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: number;
  title: string;
  body: string | null;
  severity: 'info' | 'warn' | 'critical' | 'emergency';
  target_type: 'all' | 'zone' | 'display';
  target_id: number | null;
  starts_at: string;
  ends_at: string | null;
  duration_seconds: number | null;
  play_sound: number;
  active: number;
  sent_by_name?: string;
  created_at: string;
}
