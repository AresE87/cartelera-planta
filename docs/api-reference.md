# API Reference

Base URL: `http://carteleria.empresa.local:8080/api` (o la que hayas configurado).

Todas las respuestas son JSON. Los timestamps son ISO 8601 UTC.

## Autenticación

La mayoría de los endpoints requieren un JWT en `Authorization: Bearer <token>` header (o `?token=<t>` query param).

### POST `/auth/login`

```json
// Request
{ "email": "admin@cartelera.local", "password": "admin1234" }

// Response 200
{
  "token": "eyJ...",
  "user": { "id": 1, "email": "...", "name": "...", "role": "admin" }
}

// Response 401
{ "error": "Invalid credentials" }
```

### GET `/auth/me`

Retorna el usuario del token actual.

```json
{ "user": { "id": 1, "email": "...", "name": "...", "role": "admin", ... } }
```

### POST `/auth/logout`

Stateless — cliente descarta el token. No-op del lado server, devuelve `{ok:true}`.

---

## Users (solo admin)

### GET `/users` · POST `/users` · GET|PATCH|DELETE `/users/:id`

CRUD estándar. Cuerpo de `POST`:

```json
{
  "email": "nuevo@cartelera.local",
  "password": "MinimoOchoChars",
  "name": "Nombre completo",
  "role": "rrhh"
}
```

---

## Zones

```
GET    /zones                    — todos
POST   /zones                    — crea    (rol: admin, comunicaciones)
GET    /zones/:id                — con displays asociados
PATCH  /zones/:id                — actualiza (rol: admin, comunicaciones)
DELETE /zones/:id                — borra    (rol: admin)
```

Cuerpo (POST/PATCH):
```json
{
  "name": "Comedor",
  "description": "TV del comedor",
  "parent_id": null,
  "color": "#3b82f6"
}
```

---

## Displays

```
GET    /displays                              — todas
POST   /displays                              — crea con pairing_code (rol: admin, comunicaciones)
GET    /displays/:id                          — detalle + últimos heartbeats
PATCH  /displays/:id                          — actualiza
DELETE /displays/:id                          — borra (rol: admin)
POST   /displays/:id/regenerate-pairing       — nuevo código (rol: admin, comunicaciones)
POST   /displays/:id/set-layout               — asigna current_layout_id
POST   /displays/:id/reload                   — broadcast refresh vía WS
```

Cuerpo POST:
```json
{
  "name": "TV Comedor",
  "zone_id": 1,
  "resolution": "1920x1080",
  "orientation": "landscape"
}
```

Respuesta POST:
```json
{ "id": 42, "pairing_code": "AB3X7K" }
```

---

## Media

```
GET    /media                  — lista últimos 500
POST   /media/upload           — multipart/form-data, field name "file" (rol varios)
DELETE /media/:id              — (rol: admin, comunicaciones)
GET    /media/file/<filename>  — archivo crudo (estático, sin auth — público)
```

Tipos MIME permitidos:
- `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- `video/mp4`, `video/webm`
- `audio/mpeg`, `audio/ogg`
- `text/html`

Límite por defecto: **50 MB** (configurable via `MAX_UPLOAD_MB`).

---

## Layouts

```
GET    /layouts                    — lista
POST   /layouts                    — crea
GET    /layouts/:id                — con definition parseada
PATCH  /layouts/:id                — actualiza
DELETE /layouts/:id                — (rol: admin)
POST   /layouts/:id/duplicate      — copia con estado "borrador"
```

Formato del `definition`:
```json
{
  "regions": [
    {
      "id": "main",
      "name": "Principal",
      "x": 0, "y": 0, "w": 1920, "h": 1080,
      "loop": true,
      "transition": "fade",
      "items": [
        { "type": "widget", "widgetId": 3, "durationMs": 10000 },
        { "type": "media",  "mediaId": 7,  "durationMs": 8000 },
        { "type": "text",   "text": "Hola", "durationMs": 5000, "style": { "color": "white" } }
      ]
    }
  ]
}
```

---

## Schedules

```
GET    /schedules[?zone_id=...&display_id=...&active=true]
POST   /schedules
GET    /schedules/:id
PATCH  /schedules/:id
DELETE /schedules/:id
```

Cuerpo POST (campos opcionales excepto `layout_id`, `name`, y uno de {zone_id, display_id}):
```json
{
  "name": "Horario de almuerzo",
  "layout_id": 5,
  "zone_id": 1,
  "days_of_week": "1,2,3,4,5",
  "start_time": "11:30",
  "end_time": "15:00",
  "starts_at": "2026-04-01T00:00:00Z",
  "ends_at":   "2026-12-31T23:59:59Z",
  "priority": 50,
  "active": true
}
```

---

## Widgets

```
GET    /widgets                — lista
POST   /widgets                — crea
GET    /widgets/:id            — detalle con config y cached_payload parseado
PATCH  /widgets/:id            — actualiza (resetea cache)
DELETE /widgets/:id            — (rol: admin, comunicaciones)
GET    /widgets/:id/data       — payload actual (cacheado o fresh según TTL)
POST   /widgets/:id/refresh    — fuerza refresh y broadcast a players
```

Cuerpo POST:
```json
{
  "type": "beneficios",
  "name": "Beneficios abril",
  "config": { "source": "url", "filtros": { "onlyActive": true } },
  "data_source_url": "http://middleware-rrhh:4001/beneficios",
  "refresh_seconds": 300
}
```

Tipos disponibles: `beneficios`, `cumpleanos`, `avisos`, `kpis`, `alertas`, `clima`, `reloj`, `rss`, `texto`, `imagen_url`, `youtube`, `iframe`.

### Payload estándar devuelto por `/widgets/:id/data`

```json
{
  "type": "beneficios",
  "generatedAt": "2026-04-24T12:34:56Z",
  "ttlSeconds": 300,
  "data": { /* specific to widget type */ }
}
```

---

## Alerts

```
GET    /alerts[?active=true]      — lista
POST   /alerts                    — crea y broadcastea (rol: admin, comunicaciones, seguridad)
POST   /alerts/:id/dismiss        — cierra
```

Cuerpo POST:
```json
{
  "title": "Simulacro de evacuación",
  "body": "Seguir las indicaciones de HSE",
  "severity": "warn",
  "target_type": "all",
  "target_id": null,
  "duration_seconds": 300,
  "play_sound": false,
  "color": "#dc2626",
  "icon": "🚨"
}
```

`severity`: `info`, `warn`, `critical`, `emergency`.
`target_type`: `all`, `zone`, `display` (con `target_id`).

---

## Player endpoints

Usados por los **display clients**, con auth de display token (no user).

### POST `/player/pair` (público)

```json
// Request
{ "code": "AB3X7K", "hardware_info": { ... }, "user_agent": "..." }

// Response
{ "token": "eyJ...", "display_id": 42 }
```

### GET `/player/config` (display token)

Retorna el config completo que el player necesita: layout resuelto + alertas activas + info del display.

```json
{
  "display": { "id": 42, "name": "TV Comedor", "zone_id": 1, "zone_name": "Comedor", ... },
  "layout": { "id": 5, "name": "...", "width": 1920, "height": 1080, "definition": { ... } },
  "alerts": [ ... ],
  "server_time": "..."
}
```

### POST `/player/heartbeat`

```json
{ "cpu": 15.2, "memory": 280, "uptime_s": 10800, "version": "1.0.0" }
```

### GET `/player/widget/:id/data`

Devuelve el payload de un widget (mismo shape que `/widgets/:id/data`, pero autenticado como display).

---

## WebSocket

Endpoint: `/ws?token=<jwt>`. Funciona tanto con user tokens como display tokens.

### Eventos server → client

```json
{ "type": "hello", "serverTime": "..." }
{ "type": "refresh" }
{ "type": "layout_change", "layoutId": 5 }
{ "type": "alert", "alert": { ... } }
{ "type": "alert_dismiss", "id": 12 }
{ "type": "widget_update", "widgetId": 3 }
```

### Eventos client → server

```json
{ "type": "subscribe", "channel": "zone:1" }      // solo admin
{ "type": "unsubscribe", "channel": "zone:1" }
{ "type": "heartbeat" }                            // solo display
```

---

## Errores

Formato estándar:
```json
{
  "error": "Validation failed",
  "code": "bad_request",
  "details": { ... }
}
```

Códigos HTTP:
- `400` validación (details trae el breakdown de Zod)
- `401` sin/mal token
- `403` rol insuficiente
- `404` recurso no encontrado
- `409` conflicto (ej. email duplicado)
- `413` archivo demasiado grande
- `500` error interno

---

## Rate limits y CORS

- **Sin rate limit por default.** Si lo necesitás, agregá `express-rate-limit` en el backend.
- **CORS:** controlado con `CORS_ORIGIN` en `.env`. En prod poné `https://carteleria.empresa.local`. `*` solo para dev.
