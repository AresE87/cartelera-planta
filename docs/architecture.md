# Arquitectura

## Visión general

Cartelera Planta es una plataforma self-hosted de cartelería digital. Tres componentes principales:

1. **Backend** — API REST + WebSocket server (Node/TypeScript + SQLite)
2. **Admin dashboard** — SPA React para configuración y operación
3. **Display client** — cliente HTML5 que corre en cada TV a través de un player (Raspberry Pi / Android TV)

Todo orquestado con Docker Compose y expuesto tras un reverse proxy (Caddy).

```
┌──────────────────────────────────────────────────────────────┐
│                    Server (Ubuntu + Docker)                   │
│                                                               │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐                │
│   │  Caddy    │→ │  Backend  │→ │  SQLite   │                │
│   │  :80/:443 │  │  :3000    │  │ (file)    │                │
│   └───────────┘  └───────────┘  └───────────┘                │
│         ↓              ↕                                      │
│   ┌───────────┐  ┌───────────┐                                │
│   │ Admin UI  │  │Middleware │                                │
│   │ (Nginx)   │  │ :4001-3   │                                │
│   └───────────┘  └───────────┘                                │
└──────────────────────────────────────────────────────────────┘
         ↓ HTTPS (o HTTP en LAN) + WebSocket
┌──────────────────────────────────────────────────────────────┐
│                    Players (en cada TV)                       │
│                                                               │
│  Raspberry Pi / Android TV → browser kiosk → Display client   │
│  LocalStorage cache + Service Worker (offline)                │
└──────────────────────────────────────────────────────────────┘
```

---

## Backend

### Stack

- **Runtime:** Node.js 22 + TypeScript
- **HTTP:** Express 4
- **DB:** SQLite 3 con better-sqlite3 (driver síncrono, rapidísimo para este volumen)
- **Auth:** JWT (HS256) + bcryptjs
- **Validación:** Zod
- **Uploads:** multer (archivos en disco local)
- **WebSocket:** `ws` (nativo, sin Socket.io)

### Esquema de datos

Ver [`backend/src/db/schema.sql`](../backend/src/db/schema.sql). Tablas principales:

- `users` — admins, RRHH, producción, etc. con roles
- `zones` — agrupación jerárquica opcional (parent_id)
- `displays` — pantallas físicas, cada una con token JWT de larga vida
- `media` — imágenes, videos, HTML, audio subidos
- `layouts` — composición de regiones + items (widgets/media/texto) en JSON
- `schedules` — cuándo mostrar qué layout, por zona o display
- `widgets` — instancias configurables de los tipos built-in
- `alerts` — comunicaciones urgentes con target + severidad
- `audit_log` — trazabilidad de operaciones
- `heartbeats` — pings de los players para monitoreo

### Routing

```
/api/health
/api/auth/{login,me,logout}
/api/users/*              (admin only)
/api/zones/*
/api/displays/*
/api/media/{upload, :id}
/api/layouts/{CRUD, duplicate}
/api/schedules/*
/api/widgets/{CRUD, :id/data, :id/refresh}
/api/alerts/{POST, dismiss}
/api/player/{pair, config, heartbeat, widget/:id/data}   ← display auth
/ws                                                      ← WebSocket
```

### WebSocket

Un único endpoint `/ws?token=<jwt>`:

- Si el token es de un **user**, se suscribe al canal `admin` + `all`.
- Si es de un **display**, se suscribe a `display:<id>` + `zone:<zone_id>` + `all`.

Mensajes server → client:
- `{type: 'hello', serverTime}` — al conectar
- `{type: 'refresh'}` — el player debería refetch config
- `{type: 'layout_change', layoutId}`
- `{type: 'alert', alert}` — nueva alerta push
- `{type: 'alert_dismiss', id}` — alerta cerrada
- `{type: 'widget_update', widgetId}` — datos del widget cambiaron

El backend mantiene un registro en memoria de clientes; no hay servidor central de PubSub (todo single-node).

### Widget engine

Cada widget tiene un **tipo** y una **config JSON**. El engine en `backend/src/widgets/engine.ts` registra builders por tipo. Cada builder recibe `(widget, config)` y devuelve un **payload** con `{ type, generatedAt, ttlSeconds, data }`.

El payload se cachea en `widgets.cached_payload` y se reutiliza mientras `ttlSeconds` no haya expirado. La refresh se puede forzar vía POST `/api/widgets/:id/refresh`.

Tipos built-in: `beneficios`, `cumpleanos`, `avisos`, `kpis`, `alertas`, `clima`, `reloj`, `rss`, `texto`, `imagen_url`, `youtube`, `iframe`.

### Scheduler

`backend/src/services/scheduler.ts` resuelve qué layout debe mostrar un display en un momento dado. Orden de precedencia:

1. Schedule `display_id` match + hora + DOW + prioridad máxima
2. Schedule `zone_id` match + hora + DOW + prioridad máxima
3. `displays.current_layout_id` como fallback
4. "Sin layout" (el player muestra mensaje de bienvenida)

---

## Admin dashboard

### Stack

- **Framework:** React 18 + TypeScript
- **Build:** Vite 5
- **Routing:** React Router 6
- **UI:** Tailwind 3 + componentes custom
- **State:** hooks + localStorage (sin Redux/Zustand — no hace falta)

### Páginas

| Ruta | Rol min. | Descripción |
|------|----------|-------------|
| `/` | todos | Dashboard con stats + alertas activas |
| `/zones` | rw: admin, comunicaciones | CRUD de zonas |
| `/displays` | rw: admin, comunicaciones | Lista + alta (con pairing code) |
| `/displays/:id` | todos | Detalle + heartbeats + setter de layout |
| `/media` | rw: varios | Upload/borrado de archivos |
| `/layouts` | rw: varios | Lista + creación |
| `/layouts/:id` | rw: varios | Editor visual |
| `/schedules` | rw: varios | Programación |
| `/widgets` | rw: varios | Lista |
| `/widgets/:id` | rw: varios | Editor con JSON + preview de data |
| `/alerts` | rw: admin, comunicaciones, seguridad | Envío de alertas |
| `/users` | admin only | Gestión de accesos |

---

## Display client

### Stack

- **Framework:** ninguno (vanilla HTML + JS + CSS)
- **Offline:** Service Worker con cache-first para static, network-first-with-fallback para API

### Flujo

1. Al abrir, chequea LocalStorage `cartelera.token`
2. Sin token → pantalla de pairing (input de 6 chars)
3. Con token → fetch `/api/player/config` → render layout
4. Conecta a WebSocket
5. Envía heartbeat cada 45s
6. Al recibir `refresh`/`layout_change`/`widget_update`, refetch lo pertinente
7. Si pierde conexión, sigue mostrando el último config cacheado (Service Worker + LocalStorage)

### Renderizado de layouts

- Cada **región** es un div con posición absoluta escalada al viewport
- Los **items** de cada región rotan con `setTimeout` según `durationMs`
- Transiciones con CSS opacity (fade)
- Widgets se renderizan llamando a `window.CarteleraRenderers.render(el, payload)`

---

## Middleware de integración

Servicios pequeños independientes que exponen endpoints JSON. Los widgets les apuntan via `data_source_url`. Ver [middleware/README.md](../middleware/README.md).

---

## Decisiones de diseño

### ¿Por qué SQLite y no PostgreSQL?

- Zero-config, zero-ops.
- Rápido con `better-sqlite3` (sync, menor overhead).
- Para este volumen (pantallas en una sola planta, no miles de usuarios concurrentes) sobra.
- Backup = copiar un archivo. Restore = reemplazar un archivo.
- Si llegado el caso se necesita escalar: migración trivial a Postgres cambiando el driver.

### ¿Por qué no Xibo (como indicaba el plan original)?

Se evaluó Xibo como "motor base" en el plan. Build final razonó que:
- La "capa a medida" iba a ser el 70%+ del esfuerzo de todas formas
- Xibo 4 cambió a AGPL, lo cual impacta según uso interno
- Dueños de producto corporativo suelen preferir una capa propia por control
- Las features esenciales (layouts, scheduling, widgets, push, roles, offline) son <5k LOC cuando las hacés desde cero con el set de features exacto que querés

El resultado es una codebase 100% ownership de la empresa, sin dependencia de proyecto externo.

### ¿Por qué WebSocket nativo y no Socket.io?

- Socket.io agrega 100kb+ al bundle
- Reconexión manual es fácil en <50 líneas
- No necesitamos fallback a long-polling (LAN confiable)

### ¿Por qué Caddy y no Nginx?

- Config declarativa y legible
- TLS interno automático (perfecto para `carteleria.empresa.local`)
- Menos rotura de historial: el `Caddyfile` es más compacto
- Si preferís Nginx, es trivial swap

---

## Seguridad

- JWT con secret ≥32 chars (generado al instalar)
- Contraseñas con bcrypt (10 rounds default)
- UFW bloqueando todo excepto SSH y HTTP/HTTPS
- fail2ban por intentos SSH y HTTP
- unattended-upgrades para parches automáticos
- Display tokens **no expiran** (fáciles de revocar regenerando pairing)
- CORS restrictivo en producción (`.env` `CORS_ORIGIN=https://carteleria.empresa.local`)
- No hay acceso a internet desde los widgets, solo a URLs whitelisted (excepto Open-Meteo para clima si está habilitado)

Más detalles en [security.md](security.md).
