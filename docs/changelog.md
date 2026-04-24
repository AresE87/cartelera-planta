# Changelog

Todos los cambios importantes del proyecto se documentan acá.
Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [1.1.0] — 2026-04-24

### Security
- **SSRF guard** (`backend/src/util/safe-fetch.ts`): bloquea metadata IPs (169.254.0.0/16), 0.x, broadcast, multicast, e IPv6 reservadas. Esquemas no-HTTP rechazados en write-time. Redirects re-validados en cada hop. Tamaño de respuesta limitado, timeout configurable.
- **Validación URL en write-time** para widgets `iframe`, `imagen_url`, `rss`, `clima` (custom), `beneficios|cumpleanos|avisos|kpis` (`source: 'url'`) y `data_source_url`. Rechaza `file:`, `javascript:`, `data:`, credenciales embebidas.
- **Rate limiting** in-memory token bucket (`backend/src/util/rate-limit.ts`):
  - `/api/auth/login`: 5 intentos burst, refill 1 cada 12s (≈ 5/min).
  - `/api/player/pair`: 10 intentos burst, refill 1 cada 6s.
  - `/api/*` general: 240 burst, 4 RPS sostenido.
  - Header `Retry-After` incluido en respuestas 429.
- **Security headers** (`backend/src/util/security-headers.ts`): `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `COOP/CORP`, HSTS condicional.
- **Body limit**: bajado de 10MB a 1MB para JSON/urlencoded (uploads de media siguen en 50MB vía multer).
- **WebSocket hardening**:
  - Display tokens ahora se bindean al `displays.api_token`. Si admin regenera el pairing, la conexión vieja queda invalidada (close 4003).
  - Admin WS: `subscribe` solo acepta canales `all|admin|zone:N|display:N`. Mensajes >4 KB se descartan.
- **Pairing codes con CSPRNG** (`crypto.randomInt`) en lugar de `Math.random`.
- **No leak de `api_token`** en `GET /api/displays` y `GET /api/displays/:id`.
- **Production safety check**: el backend se rehúsa a arrancar en `NODE_ENV=production` si `JWT_SECRET` es el default o tiene < 32 chars.
- `x-powered-by` deshabilitado.

### Tests
- Suite de tests reescrita: 60 tests en 11 suites, ejecutándose en procesos aislados.
- `tests/safe-fetch.test.ts` — 21 tests cubriendo validación de URL, clasificación de IPs, comportamiento HTTP (redirects, tamaño, timeout, cloud metadata).
- `tests/rate-limit.test.ts` — 3 tests (capacidad, refill, keyFn custom).
- `tests/auth.test.ts` — 8 tests (login, role guard, brute-force).
- `tests/widgets.test.ts` — 12 tests (CRUD, SSRF write-time, rate-limit por payload size).
- `tests/scheduler.test.ts` — 7 tests (DOW, time window, prioridad, fallbacks).
- `tests/display-pair.test.ts` — 6 tests (pairing flow, regeneración, no-leak de token).
- `tests/unit.test.ts` — 4 tests (passwords, JWT).
- Test runner ahora usa `--test-isolation=process` para aislar singletons.

### Fixed
- `verifyToken` cast inseguro entre `string | jwt.JwtPayload` (typecheck error pre-existente).
- `schedules.writeSchema` no podía hacer `.partial()` por `.refine()` (typecheck error pre-existente). Refactorizado a validación manual `requireTarget`.
- `admin/api.ts`: `updateLayout` y `updateSchedule` ahora aceptan `boolean | number` para `published` y `active`.

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
