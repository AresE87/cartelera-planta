# Guía del administrador

Para el rol `admin` (y supervisores técnicos). Cubre operaciones que van más allá del uso diario.

## Gestión de usuarios

### Roles disponibles

| Rol | Qué puede hacer |
|-----|-----------------|
| `admin` | Todo — único que puede crear/borrar usuarios y zonas. |
| `comunicaciones` | Gestión completa de contenido, pantallas, programación, alertas. |
| `rrhh` | Contenido + widgets (foco en beneficios, cumpleaños, avisos). |
| `produccion` | Contenido + widgets (foco en KPIs, avisos operativos). |
| `seguridad` | Contenido + alertas urgentes. |
| `operator` | Solo lectura — ver estado de pantallas. |

### Buenas prácticas

- Mantené **al menos 2 usuarios con rol admin** por si uno pierde el acceso.
- Desactivá usuarios cuando alguien sale de la empresa (no los borres — preservás el audit_log con referencia).
- Rotá contraseñas cada 6 meses para el usuario `admin@cartelera.local` genérico.
- Personaliza cada usuario (no compartas credenciales) para que el audit log sea útil.

## Permisos efectivos

Hay dos capas:
1. **Rol del usuario** (cuadro arriba) — qué endpoints puede hitear.
2. **Layouts y zonas** — todos los usuarios de rol `rrhh`+ pueden editar *cualquier* zona/layout. Si querés segmentación fina (ej. "RRHH solo ve Comedor"), se puede extender con ACL a nivel recurso en una siguiente versión.

## Monitoreo

### Dashboard

La home del admin muestra en tiempo real:
- Total de pantallas, online, offline, error
- Alertas activas (se puede cerrar una desde acá)

### Detalle de pantalla

Entrá en una pantalla para ver:
- Estado, última conexión
- Últimos 20 heartbeats con CPU, memoria, uptime, versión del player

### Logs del backend

```bash
docker compose logs -f backend
```

Filtrá por nivel con `LOG_LEVEL=debug` en `.env`.

### Audit log SQL

```bash
docker exec -it cartelera-backend sqlite3 /data/cartelera.db
```

```sql
SELECT u.email, a.action, a.entity_type, a.entity_id, a.created_at
FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
ORDER BY a.created_at DESC
LIMIT 100;
```

## Actualización del sistema

```bash
cd /opt/cartelera
git pull --ff-only
docker compose build
docker compose up -d
docker compose logs -f --tail=50
```

La DB se migra automáticamente al arrancar (idempotente, usa `CREATE ... IF NOT EXISTS`).

## Rotación de JWT secret

Si sospechás que el secret se comprometió:

1. Generá nuevo: `openssl rand -hex 32`
2. Cambialo en `.env` (`JWT_SECRET`)
3. `docker compose restart backend`
4. **Todos los users tendrán que re-loguear.**
5. **Los displays quedarán desvinculados** — hay que regenerar pairing code por pantalla.

Es una operación disruptiva; tenela documentada como parte del plan de incidentes.

## Backup & restore

### Automático

El script `install-ubuntu.sh` ya instaló un cron que corre `backup.sh` todas las noches a las 03:00.

Los backups quedan en `/var/backups/cartelera`:
- `db-YYYYMMDD-HHMMSS.sqlite.gz`
- `uploads-YYYYMMDD-HHMMSS.tar.gz`

Se rotan automáticamente a los 30 días (`KEEP_DAYS=30`).

### Verificar que los backups sirven

**Esto es importante: un backup que no se probó no es un backup.**

Una vez por trimestre, restaurá en un server de prueba:

```bash
scp /var/backups/cartelera/db-*.sqlite.gz otro-server:/tmp/
scp /var/backups/cartelera/uploads-*.tar.gz otro-server:/tmp/
# en otro-server, con una instancia de test:
bash scripts/restore.sh /tmp/db-XXXXXXXX.sqlite.gz /tmp/uploads-XXXXXXXX.tar.gz
```

Verificá que podés loguear, que las pantallas se ven, y que la media está.

### Off-site

Configurá una copia a NAS/S3/cloud:

```bash
# Ejemplo con rsync a un NAS en la LAN (agregá al cron)
rsync -avz /var/backups/cartelera/ usuario@nas:/volumes/backups/cartelera/
```

## Migración a otro servidor

1. Backup de DB y uploads en el server viejo.
2. Instalar el nuevo server con `install-ubuntu.sh`.
3. `docker compose stop backend`.
4. Copiar los backups y restaurarlos con `restore.sh`.
5. `docker compose start backend`.
6. Los displays se reconectan solos (el server resuelve por DNS interno).

## Desactivar una pantalla temporalmente

Pausar sin desvincular:

```bash
# Opción A: via SQL
docker exec cartelera-backend sqlite3 /data/cartelera.db \
  "UPDATE displays SET status = 'paused' WHERE name = 'TV Comedor'"

# Opción B: via API (si el admin UI lo expone en una versión futura)
```

## Performance

Con el volumen esperado (decenas de pantallas, cientos de layouts, miles de medias):

- SQLite soporta cientos de writes/s sin problema
- Uploads sobre 100 MB → usar S3-compatible en lugar de disco local (customización)
- Widgets con fetches a sistemas lentos → subí el `refresh_seconds` para no golpear el source

Los cuellos de botella esperables no son backend sino:
1. Ancho de banda de red si las medias son muy pesadas
2. CPU del player viejo renderizando video 4K (usá 1080p o H.264)
