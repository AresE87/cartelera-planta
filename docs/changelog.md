# Changelog

Todos los cambios importantes del proyecto se documentan acá.
Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [1.0.0] — 2026-04-24

Primera release. Todo el MVP alineado con el plan del proyecto.

### Added

**Backend (API + WebSocket)**
- Auth JWT + bcrypt con 6 roles (admin, rrhh, produccion, seguridad, comunicaciones, operator)
- CRUD completo: users, zones, displays, media, layouts, schedules, widgets, alerts
- Widget engine con 12 tipos built-in (beneficios, cumpleanos, avisos, kpis, alertas, clima, reloj, rss, texto, imagen_url, youtube, iframe)
- Scheduler que resuelve layouts por display/zone + horario + prioridad
- Display pairing flow con códigos de 6 chars (30 min expiry)
- WebSocket para push real-time: refresh, layout_change, alerts, widget_update
- Audit log de operaciones mutables
- Heartbeat de players con histórico
- Media uploads con límite 50 MB configurable
- Seed script con demo data (usuarios, zonas, widgets, layout del comedor)

**Admin dashboard**
- Login + session management
- Dashboard con stats en vivo y alertas activas
- CRUD visual de zonas, pantallas (con pairing code reveal)
- Editor visual de layouts con canvas de regiones
- Schedules con DOW picker + time range + fecha
- Widget editor con config JSON + preview de data
- Alert composer con plantillas + severity + targeting + sound
- Gestión de usuarios (admin-only)
- Tema claro con Tailwind + shadcn-style components

**Display client (player)**
- Pairing screen con input de 6 chars
- Player runtime con renderizado de regiones + rotación de items
- Fade transitions
- WebSocket con reconexión exponencial
- Heartbeat periódico
- Service Worker con cache offline (cache-first static, network-first-fallback API)
- LocalStorage caching de config + widget data (resiliencia offline)
- 12 widget renderers
- Alert overlay con severity, icon, optional sound
- Atajos: Ctrl+Shift+U desvincular, Ctrl+Shift+R reload

**Middleware de integración**
- `rrhh-sync` (:4001) — expone /beneficios, /cumpleanos, /avisos desde JSON
- `produccion-adapter` (:4002) — expone /kpis con simulación
- `seguridad-feed` (:4003) — webhook para emitir alertas desde sistemas externos

**Infra / Deploy**
- Docker Compose con backend + admin + caddy + 3 middleware
- Caddyfile con reverse proxy para /api, /ws, /media, /admin, /display
- Dockerfile multi-stage para backend (builder + runtime non-root)
- Dockerfile para admin (build + nginx)
- Script `install-ubuntu.sh` end-to-end (UFW, fail2ban, Docker, systemd, cron)
- Script `player-setup.sh` para Raspberry Pi kiosk
- Script `backup.sh` con SQLite consistent backup + rotación 30 días
- Script `restore.sh` interactivo
- Script `health-check.sh` para smoke test

**Documentación**
- README con quickstart
- plan.md (plan de proyecto original)
- docs/architecture.md
- docs/install-guide.md
- docs/user-manual.md
- docs/admin-guide.md
- docs/api-reference.md
- docs/widget-development.md
- docs/operations.md
- docs/security.md
- docs/changelog.md

### Known limitations

- **SQLite single-node**: no hay replicación. Para HA, migrar a Postgres + Patroni.
- **Media en disco local**: no apto para cluster. Migrar a S3-compatible para eso.
- **Sin rate limiting** en la API (no crítico en LAN interna, añadir si se expone a más redes).
- **Scheduler no gestiona conflictos complejos** (solo orden por prioridad + timestamp). Schedules superpuestos con misma prioridad son resueltos por fecha de creación.
- **Drag & drop** en el editor de layouts aún no implementado (se usa edición numérica). Roadmap.
- **Video streaming** solo MP4/WebM. No hay HLS/RTSP.
- **Métricas Prometheus** no expuestas aún.

### Roadmap v1.1

- Drag & drop en layout editor
- Playlists (reemplazo del "region + items" actual por una entidad reutilizable)
- Multi-tenant (distintas carpetas/marcas en el mismo server)
- Métricas Prometheus
- Push notifications a admins cuando pantallas caen
- Editor WYSIWYG de widgets HTML custom
