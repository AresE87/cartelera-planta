# Operaciones

Runbook para el equipo de TI / SRE.

## Comandos cotidianos

```bash
# Ver estado
cd /opt/cartelera
docker compose ps

# Logs en vivo
docker compose logs -f              # todos los servicios
docker compose logs -f backend      # solo backend
docker compose logs -f --tail=200 backend

# Reiniciar un servicio
docker compose restart backend

# Actualizar código
git pull
docker compose build
docker compose up -d

# Ejecutar comandos dentro de containers
docker exec -it cartelera-backend sh
docker exec cartelera-backend sqlite3 /data/cartelera.db ".tables"
```

## Troubleshooting

### "No veo ninguna pantalla online"

1. `docker compose ps` → ¿el backend está `healthy`?
2. `curl http://localhost:8080/api/health` → ¿responde?
3. Revisá logs del backend: `docker compose logs --tail=100 backend`
4. Desde un player, abrí la URL directamente en browser y mirá console.
5. Chequeá que el firewall no bloquee 8080 o 443 entre players y server.

### "Un display no se conecta"

1. En la pantalla, ctrl+shift+U para desvincular.
2. Regenerá pairing en el admin.
3. Probá abrir `http://carteleria.empresa.local:8080/api/health` desde el player — si falla es red, no cartelera.

### "El admin dice 401 todo el tiempo"

El token JWT expiró. Simplemente volvé a loguear. Si pasa muy seguido, subí `JWT_EXPIRES_IN` en `.env`.

### "La DB está corrupta"

SQLite es resiliente, pero por las dudas:

```bash
docker exec cartelera-backend sqlite3 /data/cartelera.db "PRAGMA integrity_check"
```

Si reporta problemas, restaurá el último backup.

### "El disco se llena"

Ordená qué ocupa:

```bash
du -sh /var/lib/docker/volumes/cartelera_cartelera-data/
du -sh /var/backups/cartelera/
```

Cosas a limpiar:
- Backups viejos (el script ya lo hace a los 30 días)
- Media sin usar (no hay GC automático; query manual):

```sql
-- En sqlite
SELECT id, filename, original_name, size_bytes
FROM media
WHERE id NOT IN (
  -- Media referenciada en algún layout
  SELECT CAST(json_extract(value, '$.mediaId') AS INTEGER)
  FROM layouts,
  json_each(json_extract(definition, '$.regions')),
  json_each(json_extract(value, '$.items'))
  WHERE json_extract(value, '$.type') = 'media'
)
ORDER BY size_bytes DESC;
```

Identificá lo huérfano y borralo desde el admin o vía SQL.

### "Los heartbeats no llegan"

Con 100+ pantallas, la tabla crece. Limpiala periódicamente:

```sql
DELETE FROM heartbeats WHERE created_at < datetime('now', '-7 days');
VACUUM;
```

Lo ideal es automatizarlo con un cron diario dentro del container.

## Monitoreo externo

Integrá con lo que uses:

- **Uptime Kuma** / StatusCake: HTTP check a `/api/health` cada 1-5 min.
- **Prometheus:** agregá un endpoint `/metrics` (pendiente de v2) o usá node_exporter para host stats.
- **Sentry:** para capturar excepciones del backend, añadir `@sentry/node` en `src/index.ts`.

Alertas razonables:
- Backend down > 2 min
- 50% o más de pantallas offline simultáneamente (probable corte de red)
- Disco > 85% usado
- CPU load > 80% sostenido

## Actualizaciones del SO

Las actualizaciones de seguridad se aplican solas (unattended-upgrades). Para un upgrade mayor de Ubuntu:

1. Backup completo antes
2. `sudo do-release-upgrade` desde una SSH con pantalla (por si pide interacción)
3. Reboot
4. Verificar que Docker levante y la app también

## Actualización de Docker / Docker Compose

```bash
sudo apt-get update
sudo apt-get upgrade docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Los containers se reinician automáticamente después.

## Capacity planning

Volúmenes razonables para un Ubuntu con 4 CPU / 4 GB RAM / 40 GB disco:

| Métrica | Límite cómodo |
|---------|---------------|
| Pantallas | 200 |
| Layouts | 1000 |
| Media (total) | 20 GB |
| Audit log | 10 M filas antes de limpiar |
| Heartbeats/min | 400 |

Llegando a esos números, considerar:
- Migrar SQLite → PostgreSQL
- Mover media a S3-compatible (MinIO local)
- Agregar un worker dedicado para widgets con fetches lentos
