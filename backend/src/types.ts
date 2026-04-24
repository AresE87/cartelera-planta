export type Role = 'admin' | 'rrhh' | 'produccion' | 'seguridad' | 'comunicaciones' | 'operator';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithHash extends User {
  password_hash: string;
}

export interface Zone {
  id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Display {
  id: number;
  zone_id: number | null;
  name: string;
  description: string | null;
  pairing_code: string | null;
  pairing_expires_at: string | null;
  api_token: string | null;
  status: 'offline' | 'online' | 'error' | 'paused';
  last_seen_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  hardware_info: string | null;
  current_layout_id: number | null;
  resolution: string;
  orientation: 'landscape' | 'portrait';
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
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  tags: string | null;
  uploaded_by: number | null;
  created_at: string;
}

export interface LayoutRegion {
  id: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  items: LayoutItem[];
  loop?: boolean;
  transition?: 'none' | 'fade' | 'slide';
}

export type LayoutItem =
  | { type: 'media'; mediaId: number; durationMs: number }
  | { type: 'widget'; widgetId: number; durationMs: number }
  | { type: 'text'; text: string; durationMs: number; style?: Record<string, string> };

export interface LayoutDefinition {
  regions: LayoutRegion[];
  globalStyle?: Record<string, string>;
}

export interface Layout {
  id: number;
  name: string;
  description: string | null;
  width: number;
  height: number;
  background_color: string;
  definition: string;
  published: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  layout_id: number;
  zone_id: number | null;
  display_id: number | null;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  days_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  priority: number;
  active: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export type WidgetType =
  | 'beneficios' | 'cumpleanos' | 'avisos' | 'kpis'
  | 'alertas' | 'clima' | 'reloj' | 'rss'
  | 'texto' | 'imagen_url' | 'youtube' | 'iframe';

export interface Widget {
  id: number;
  type: WidgetType;
  name: string;
  description: string | null;
  config: string;
  data_source_url: string | null;
  refresh_seconds: number;
  cached_payload: string | null;
  cached_at: string | null;
  created_by: number | null;
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
  icon: string | null;
  color: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_seconds: number | null;
  play_sound: number;
  active: number;
  sent_by: number | null;
  created_at: string;
}

export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
  type: 'user' | 'display';
}
