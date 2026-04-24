# Seguridad

## Modelo de amenaza

La cartelera vive **dentro** de la red corporativa. No se expone a internet pública. Las amenazas reales son:

1. **Acceso no autorizado al admin desde la LAN** (insider threat).
2. **Pantalla comprometida** (alguien accede físicamente al player y manipula el Pi).
3. **Alerta falsa emitida** (social engineering de un user de RRHH).
4. **Supply chain**: npm packages o docker images maliciosas.

## Mitigaciones

### Autenticación

- JWT HS256 con secret ≥ 32 chars aleatorio (generado en install)
- Password hashing bcrypt 10 rounds
- Tokens de user expiran (default 7d); display tokens no expiran pero son fáciles de revocar

### Autorización (RBAC)

6 roles con permisos crecientes. Ver [admin-guide.md](admin-guide.md).

### Red

- UFW default-deny con solo OpenSSH + 80/443 abiertos
- fail2ban para intentos de SSH y auth HTTP
- CORS restrictivo en prod (`CORS_ORIGIN=https://carteleria.empresa.local`)
- Backend escucha solo internamente en Docker (Caddy es el único puerto expuesto)

### SSH

El install script:
- Deshabilita password auth (solo keys)
- Deshabilita login root con contraseña
- Requiere haber importado tu SSH key antes de correr el install

### Data en tránsito

- Usar **HTTPS** incluso dentro de la LAN (cert interno de Caddy está pensado para esto)
- WebSocket sobre WSS cuando HTTPS está activo

### Data en reposo

- DB SQLite en un volumen Docker con permisos de Docker daemon
- Uploads con el mismo modelo
- Backups sin cifrar por defecto — si los mandás a un NAS, usá `gpg` para cifrarlos

### Logs y auditoría

Tabla `audit_log` registra cada operación mutable:
- login
- user create/update/delete
- zone/display/layout/schedule/widget/alert CRUD
- media upload/delete

Incluye `user_id`, `ip_address`, `user_agent`, timestamp. Útil para forensics post-incidente.

### Display tokens

- Un display token solo tiene acceso a `/api/player/*` (no a admin endpoints)
- Se puede revocar regenerando el pairing code de la pantalla

### Alertas urgentes

Son potente socialmente — una alerta "emergency" en todas las pantallas puede generar pánico. Mitigaciones:
- Solo roles `admin`, `comunicaciones`, `seguridad` pueden emitirlas
- Quedan en el audit log con `sent_by`
- Plantillas predefinidas reducen errores
- Un admin puede cerrar una alerta mal emitida desde el dashboard

## Parches

- **SO:** unattended-upgrades instalado por el script — aplica security updates solos.
- **Docker:** `apt-get upgrade` mensual.
- **Node packages:** `npm audit` en cada release (ver CI).
- **Base images:** el `Dockerfile` usa `node:22-bookworm-slim` (Debian estable, soporte largo). Regenerar imágenes mensualmente.

## Respuesta a incidentes

### "Sospecho que un JWT secret se comprometió"

1. Generá nuevo secret: `openssl rand -hex 32`
2. Cambialo en `/opt/cartelera/.env`
3. `docker compose restart backend`
4. Todos los users y displays deberán re-autenticar / re-emparejar.

### "Un user malintencionado borró pantallas/layouts"

1. `docker compose stop backend`
2. Restaurá el último backup con `scripts/restore.sh`
3. Consultá el audit log del dump antes de restaurar (para ver qué hizo el user)
4. Desactivá ese user
5. `docker compose start backend`

### "El server fue comprometido (RCE)"

1. Desconectá de la red
2. Snapshot forense del disco
3. Reinstalá Ubuntu desde cero en otro server
4. Restaurá solo **data** (DB y uploads) desde backup — no copies binaries ni configs
5. Rotá todos los secrets (JWT, SSH keys, passwords de users)
6. Re-empareja todas las pantallas

### "Un player comprometido emite contenido"

El player no puede emitir contenido — solo **lee** del server. Pero sí puede mostrar contenido manipulado localmente si alguien tocó el Pi. Mitigación:
- Los Pi están físicamente instalados en zonas de acceso restringido
- Si sospechás: regenerá pairing code → la pantalla pierde acceso al content remoto
- Re-flasheá la SD del Pi y reinstalá con `player-setup.sh`

## Checklist mensual

- [ ] Revisar el audit log por actividad sospechosa
- [ ] Validar que los backups siguen corriendo (`ls /var/backups/cartelera | head`)
- [ ] Aplicar `sudo apt-get update && sudo apt-get upgrade`
- [ ] Rebuild de docker images: `cd /opt/cartelera && docker compose build --no-cache && docker compose up -d`
- [ ] Revisar users activos: alguien que ya no debería tener acceso?
- [ ] Probar un restore en un ambiente separado (cada 3 meses)
