-- Cartelera Planta — SQLite schema
-- All timestamps stored as ISO 8601 strings in UTC.

-- ==============================================================
-- Users
-- ==============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','rrhh','produccion','seguridad','comunicaciones','operator')),
  active        INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ==============================================================
-- Zones — jerarquía opcional (parent_id)
-- ==============================================================
CREATE TABLE IF NOT EXISTS zones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  parent_id   INTEGER,
  color       TEXT DEFAULT '#3b82f6',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES zones(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_zones_parent ON zones(parent_id);

-- ==============================================================
-- Displays (players físicos)
-- ==============================================================
CREATE TABLE IF NOT EXISTS displays (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id           INTEGER,
  name              TEXT NOT NULL,
  description       TEXT,
  pairing_code      TEXT,
  pairing_expires_at TEXT,
  api_token         TEXT UNIQUE,
  status            TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','online','error','paused')),
  last_seen_at      TEXT,
  ip_address        TEXT,
  user_agent        TEXT,
  hardware_info     TEXT,
  current_layout_id INTEGER,
  resolution        TEXT DEFAULT '1920x1080',
  orientation       TEXT DEFAULT 'landscape' CHECK (orientation IN ('landscape','portrait')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
  FOREIGN KEY (current_layout_id) REFERENCES layouts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_displays_zone   ON displays(zone_id);
CREATE INDEX IF NOT EXISTS idx_displays_status ON displays(status);
CREATE INDEX IF NOT EXISTS idx_displays_token  ON displays(api_token);

-- ==============================================================
-- Media
-- ==============================================================
CREATE TABLE IF NOT EXISTS media (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL CHECK (type IN ('image','video','html','audio')),
  filename    TEXT NOT NULL,
  original_name TEXT,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  width       INTEGER,
  height      INTEGER,
  duration_ms INTEGER,
  tags        TEXT,
  uploaded_by INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);

-- ==============================================================
-- Layouts
-- ==============================================================
CREATE TABLE IF NOT EXISTS layouts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  description  TEXT,
  width        INTEGER NOT NULL DEFAULT 1920,
  height       INTEGER NOT NULL DEFAULT 1080,
  background_color TEXT DEFAULT '#000000',
  definition   TEXT NOT NULL,  -- JSON with regions, widgets, media
  published    INTEGER NOT NULL DEFAULT 1,
  created_by   INTEGER,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_layouts_published ON layouts(published);

-- ==============================================================
-- Schedules
-- ==============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  layout_id     INTEGER NOT NULL,
  zone_id       INTEGER,
  display_id    INTEGER,
  name          TEXT NOT NULL,
  starts_at     TEXT,
  ends_at       TEXT,
  days_of_week  TEXT,  -- CSV: 0,1,2,3,4,5,6 (0=sun)
  start_time    TEXT,  -- HH:MM
  end_time      TEXT,  -- HH:MM
  priority      INTEGER NOT NULL DEFAULT 10,  -- mayor = más prioritario
  active        INTEGER NOT NULL DEFAULT 1,
  created_by    INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id)   REFERENCES zones(id)   ON DELETE CASCADE,
  FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_schedules_layout  ON schedules(layout_id);
CREATE INDEX IF NOT EXISTS idx_schedules_zone    ON schedules(zone_id);
CREATE INDEX IF NOT EXISTS idx_schedules_display ON schedules(display_id);
CREATE INDEX IF NOT EXISTS idx_schedules_active  ON schedules(active);

-- ==============================================================
-- Widgets — definiciones reutilizables
-- ==============================================================
CREATE TABLE IF NOT EXISTS widgets (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  type             TEXT NOT NULL CHECK (type IN ('beneficios','cumpleanos','avisos','kpis','alertas','clima','reloj','rss','texto','imagen_url','youtube','iframe')),
  name             TEXT NOT NULL,
  description      TEXT,
  config           TEXT NOT NULL,   -- JSON
  data_source_url  TEXT,             -- endpoint externo opcional
  refresh_seconds  INTEGER NOT NULL DEFAULT 300,
  cached_payload   TEXT,             -- último payload fetched
  cached_at        TEXT,
  created_by       INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_widgets_type ON widgets(type);

-- ==============================================================
-- Alerts (comunicaciones urgentes)
-- ==============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT NOT NULL,
  body              TEXT,
  severity          TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical','emergency')),
  target_type       TEXT NOT NULL CHECK (target_type IN ('all','zone','display')),
  target_id         INTEGER,
  icon              TEXT,
  color             TEXT,
  starts_at         TEXT NOT NULL DEFAULT (datetime('now')),
  ends_at           TEXT,
  duration_seconds  INTEGER,
  play_sound        INTEGER NOT NULL DEFAULT 0,
  active            INTEGER NOT NULL DEFAULT 1,
  sent_by           INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active);
CREATE INDEX IF NOT EXISTS idx_alerts_target ON alerts(target_type, target_id);

-- ==============================================================
-- Audit log
-- ==============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    INTEGER,
  payload      TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date   ON audit_log(created_at);

-- ==============================================================
-- Player heartbeats (histórico corto)
-- ==============================================================
CREATE TABLE IF NOT EXISTS heartbeats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id INTEGER NOT NULL,
  cpu        REAL,
  memory     REAL,
  uptime_s   INTEGER,
  version    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_heartbeats_display ON heartbeats(display_id, created_at);
