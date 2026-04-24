# Cartelera Planta

> Sistema de cartelería digital self-hosted para plantas industriales. Gestión centralizada de contenido en TVs, con widgets configurables, comunicaciones en tiempo real, scheduling por zona, y operación offline-friendly.

Este repositorio contiene tanto el **plan de proyecto** ([`plan.md`](plan.md)) como la **implementación completa** de la plataforma.

**Estado:** ✅ v1.0 — todas las fases del plan implementadas.
Ver [`PROJECT_SUMMARY.md`](PROJECT_SUMMARY.md) para el mapeo plan ↔ código.

---

## ¿Qué resuelve?

Reemplaza el workflow de "cargar contenido con pendrive en cada TV" por una plataforma centralizada donde:

- Gestionás el contenido desde un dashboard web
- Agrupás pantallas por zonas (comedor, producción, oficinas, etc.)
- Programás qué se muestra, cuándo y dónde
- Enviás avisos urgentes en segundos a todas las pantallas (o a zonas específicas)
- Construís widgets dinámicos que se alimentan de tus sistemas internos (beneficios, cumpleaños, KPIs, alertas)
- Todo corre on-premise, sin costos recurrentes, sin exposición a internet

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    Server (Ubuntu + Docker)                   │
│                                                               │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│   │  Caddy    │→ │  Backend  │→ │  SQLite   │  │  Redis   │ │
│   │  (proxy)  │  │  (API+WS) │  │  (store)  │  │  (cache) │ │
│   └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
│         ↓              ↑                                      │
│   ┌───────────┐  ┌───────────┐                              │
│   │  Admin UI │  │Middleware │                              │
│   │  (React)  │  │(integrac.)│                              │
│   └───────────┘  └───────────┘                              │
└───────────────────────────────────────────────────────────────┘
           ↓ HTTPS + WebSocket
┌──────────────────────────────────────────────────────────────┐
│                        Players (en cada TV)                   │
│    Raspberry Pi / Android TV → navegador → Display client    │
│    Cache local, rendering offline, reconexión automática     │
└──────────────────────────────────────────────────────────────┘
```

**Stack:**

- **Backend:** Node.js + Express + TypeScript + better-sqlite3 + WebSocket nativo
- **Admin UI:** React (Vite) + Tailwind CSS
- **Display client:** HTML5 + Vanilla JS + Service Worker (offline)
- **Deploy:** Docker Compose + Caddy (reverse proxy con TLS interno)
- **Storage:** SQLite (simple, zero-config, backup = copiar un archivo)
- **Real-time:** WebSocket nativo (sin Socket.io, para minimizar deps)

---

## Estructura del repo

```
cartelera-planta/
├── plan.md                    # Plan de proyecto end-to-end
├── README.md                  # Este archivo
├── LICENSE
├── docker-compose.yml         # Orquestación completa
├── Caddyfile                  # Config reverse proxy
├── .env.example               # Template de env vars
│
├── backend/                   # API REST + WebSocket server
│   ├── src/
│   │   ├── index.ts           # Entrypoint
│   │   ├── config.ts          # Configuración
│   │   ├── db.ts              # SQLite + migrations
│   │   ├── auth.ts            # JWT + bcrypt
│   │   ├── middleware/        # Auth, RBAC, errors
│   │   ├── routes/            # REST endpoints
│   │   ├── ws/                # WebSocket handlers
│   │   ├── widgets/           # Engine de widgets
│   │   └── util/
│   ├── migrations/            # SQL migrations
│   ├── seed.ts                # Seed data para dev
│   └── package.json
│
├── admin/                     # Dashboard para administradores
│   ├── src/
│   │   ├── pages/             # Login, Dashboard, Zones, etc.
│   │   ├── components/
│   │   ├── lib/api.ts         # Cliente de API
│   │   └── main.tsx
│   └── package.json
│
├── display/                   # Cliente que corre en los players
│   ├── index.html
│   ├── player.js              # Runtime + scheduler + WS listener
│   ├── widgets/               # Renderers de widgets
│   ├── sw.js                  # Service Worker (cache offline)
│   └── styles/
│
├── middleware/                # Integraciones con sistemas internos
│   ├── rrhh-sync/             # Sync de cumpleaños desde HRIS
│   ├── beneficios-feed/       # Feed de beneficios
│   └── README.md
│
├── scripts/                   # Setup + deploy + mantenimiento
│   ├── install-ubuntu.sh      # Instalación inicial del server
│   ├── backup.sh              # Backup nocturno
│   ├── restore.sh             # Restauración desde backup
│   └── player-setup.sh        # Setup del player en Raspberry Pi
│
├── docs/                      # Documentación técnica y de usuario
│   ├── architecture.md
│   ├── api-reference.md
│   ├── user-manual.md
│   ├── admin-guide.md
│   ├── install-guide.md
│   ├── widget-development.md
│   └── operations.md
│
└── .github/
    └── workflows/
        └── ci.yml             # Lint + tests + build
```

---

## Quickstart (desarrollo local)

```bash
# 1. Clonar
git clone https://github.com/AresE87/cartelera-planta.git
cd cartelera-planta

# 2. Levantar todo con Docker Compose
cp .env.example .env
docker compose up -d

# 3. Abrir en el browser
# Admin:    http://localhost:8080
# Display:  http://localhost:8080/display?id=1
# API:      http://localhost:8080/api/health
```

Usuarios semilla:

| Email                     | Password    | Rol          |
|---------------------------|-------------|--------------|
| admin@cartelera.local     | admin1234   | admin        |
| rrhh@cartelera.local      | rrhh1234    | rrhh         |
| operador@cartelera.local  | operador1234| operator     |

---

## Instalación en producción

Ver [`docs/install-guide.md`](docs/install-guide.md).

Resumen:

1. Ubuntu Server 24.04 + hardening (script provisto)
2. Docker + Docker Compose
3. Clone de este repo + `.env` configurado
4. `docker compose up -d`
5. Players apuntan a la URL del servidor

---

## Funcionalidades

### Gestión de contenido

- Subida de imágenes, videos, HTML
- Composición de layouts con múltiples regiones
- Templates corporativos reusables
- Tags para organización

### Zonas y displays

- Agrupación jerárquica (zona → display)
- Scheduling por zona o display individual
- Estado de conexión en tiempo real
- Screenshot remoto del contenido actual

### Scheduling

- Por fecha/hora, día de semana, rango
- Priorización (layout permanente vs. campaña temporal)
- Override manual

### Avisos urgentes

- Push instantáneo a zonas o todo
- Plantillas de mensaje (seguridad, operativo, RRHH)
- Duración configurable (5 min, 15 min, hasta dismissed)

### Widgets dinámicos

- **Beneficios:** carrusel alimentado por JSON o endpoint
- **Cumpleaños del mes:** lista auto-generada
- **Avisos RRHH:** feed estructurado
- **KPIs:** gráficos desde MES/SCADA
- **Alertas de seguridad:** banner rojo con audio opcional
- **Clima, hora, fecha:** widgets utilitarios

### Roles y permisos

- **Admin:** todo
- **RRHH:** contenido general + beneficios + cumpleaños
- **Producción:** KPIs + avisos operativos
- **Seguridad:** alertas + comunicaciones urgentes
- **Operator:** solo ver estado, no editar

### Operación offline

- Players cachean el contenido localmente
- Si cae la red, siguen reproduciendo el último schedule
- Reconexión automática y sync cuando vuelve la red

---

## Licencia

MIT — ver [`LICENSE`](LICENSE).

---

## Soporte

Issues y PRs bienvenidos en GitHub.
