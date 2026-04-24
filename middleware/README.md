# Middleware de integración

Conjunto de servicios intermedios que traen data de sistemas internos (HRIS, SAP, MES, etc.) y la exponen como endpoints JSON que los widgets de Cartelera consumen.

## Filosofía

- **Desacoplados:** cada integración es un proceso chico independiente; si una falla no voltea el resto.
- **Agnósticos del protocolo origen:** leen de SQL, CSV, API externa, WebService SOAP, lo que sea, y emiten JSON parejo.
- **Seguros:** corren dentro de la red interna; exponen endpoints sin auth para los widgets (ya que el server vive en la misma LAN), pero se puede añadir API key si hace falta.
- **Observables:** cada servicio loguea cada fetch, exitoso o fallido, con timestamp y cantidad de registros.

## Servicios incluidos

| Servicio | Puerto | Qué expone | Fuente |
|----------|--------|------------|--------|
| `rrhh-sync` | 4001 | `/beneficios`, `/cumpleanos`, `/avisos` | JSON files / DB / API externa |
| `produccion-adapter` | 4002 | `/kpis` | Excel / SQL / MES |
| `seguridad-feed` | 4003 | `/alertas` | Sistema de seguridad |

## Cómo funciona

Cada servicio es un Node.js con Express muy pequeño. Toma la config del `.env`, refresca data en un intervalo, y responde a requests HTTP.

En los widgets de Cartelera, ponés `data_source_url` apuntando a `http://middleware:4001/beneficios` (por ejemplo).

## Desarrollo local

```bash
cd rrhh-sync
npm install
npm start
```

## Despliegue

Todos los middleware están incluidos en el `docker-compose.yml` raíz del proyecto.
