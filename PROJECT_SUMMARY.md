# Resumen del proyecto

Cartelera Planta — sistema de cartelería digital self-hosted.
Implementación completa del plan descrito en [plan.md](plan.md).

## Mapeo plan → entregable

| Fase del plan | Entregable en este repo |
|---------------|--------------------------|
| **Fase 0** — Alineación | [plan.md](plan.md) + [docs/architecture.md](docs/architecture.md) definen alcance, decisiones y modelo de datos |
| **Fase 1** — Infraestructura | [scripts/install-ubuntu.sh](scripts/install-ubuntu.sh) automatiza UFW, fail2ban, Docker, systemd, backups |
| **Fase 2** — Motor base + PoC | En lugar de Xibo, se desarrolló un **motor propio**: [backend/](backend/) + [admin/](admin/) + [display/](display/) |
| **Fase 3** — Validación operativa | [scripts/smoke-test.sh](scripts/smoke-test.sh) + [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| **Fase 4** — Desarrollo a medida (widgets) | [backend/src/widgets/](backend/src/widgets/) (12 tipos) + [display/widgets/renderers.js](display/widgets/renderers.js) |
| **Fase 5** — Rollout | [admin/](admin/) permite operar a escala, [scripts/player-setup.sh](scripts/player-setup.sh) automatiza los Pi |
| **Fase 6** — Integraciones avanzadas | [middleware/](middleware/): 3 ejemplos listos para adaptar a sistemas reales (HRIS, MES, HSE) |
| **Fase 7** — Operación sostenida | [docs/operations.md](docs/operations.md) + [scripts/backup.sh](scripts/backup.sh) + [scripts/restore.sh](scripts/restore.sh) |

## Por número

| Métrica | Valor |
|---------|-------|
| Archivos totales | 122 |
| Líneas de código (aprox) | 10.000+ |
| Servicios Docker | 6 (backend, admin, caddy, 3 middleware) |
| Endpoints REST | 50+ |
| Eventos WebSocket | 6 |
| Widgets built-in | 12 (beneficios, cumpleaños, avisos, KPIs, alertas, clima, reloj, RSS, texto, imagen URL, YouTube, iframe) |
| Roles de usuario | 6 (admin, comunicaciones, rrhh, producción, seguridad, operator) |
| Páginas admin UI | 11 |
| Documentos | 10 (en `docs/`) |
| Scripts ops | 8 (install, backup, restore, player-setup, health, smoke, validate, seed) |
| CI jobs | 7 |

## Tecnologías

**Backend:** Node.js 22, TypeScript, Express 4, SQLite (better-sqlite3), WebSocket (ws), JWT, bcrypt, Zod, multer

**Admin:** React 18, Vite 5, React Router 6, Tailwind 3, TypeScript

**Display:** HTML5, Vanilla JS, CSS, Service Worker, LocalStorage

**Infra:** Docker, Docker Compose, Caddy, Ubuntu 24.04, UFW, fail2ban, systemd, cron

## Cómo usarlo

```bash
# 1. En un Ubuntu 24.04 server:
sudo bash <(curl -sSL https://raw.githubusercontent.com/AresE87/cartelera-planta/main/scripts/install-ubuntu.sh)

# 2. Abrir http://<IP>:8080/admin
#    Login: admin@cartelera.local / admin1234  ← cambialo YA

# 3. En un Raspberry Pi:
curl -fsSL https://raw.githubusercontent.com/AresE87/cartelera-planta/main/scripts/player-setup.sh | \
  SERVER_URL=http://<IP>:8080 bash
sudo reboot

# 4. Emparejar: en el admin, + Pantalla, copiar el código de 6 chars,
#    ingresarlo en la TV.
```

## Qué NO incluye (roadmap)

- Drag & drop en el editor de layouts (actualmente edición numérica)
- Multi-tenant
- HA / clustering (single-node design, intencional)
- Video streaming (HLS/RTSP)
- Touchscreen / interactividad
- Métricas Prometheus (listed en docs/operations.md como extensión)

Ver [docs/changelog.md](docs/changelog.md) para el detalle.

## Soporte

Issues en [github.com/AresE87/cartelera-planta/issues](https://github.com/AresE87/cartelera-planta/issues).
