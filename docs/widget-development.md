# Desarrollo de widgets custom

Cómo agregar un nuevo tipo de widget al sistema.

## Anatomía de un widget

Cada widget tiene dos partes:

1. **Builder (backend)** — recibe la config del widget, genera un **payload** JSON con la data a mostrar.
2. **Renderer (display client)** — recibe el payload y dibuja el HTML.

El backend nunca envía HTML; solo data. El display es quien decide cómo pintarlo.

## Ejemplo: widget "marcador de producción"

### 1. Crear el builder

`backend/src/widgets/marcador.ts`:

```typescript
import type { WidgetContext, WidgetPayload } from './engine';

export async function buildMarcador(ctx: WidgetContext): Promise<WidgetPayload> {
  const cfg = ctx.config as { linea?: string; meta?: number };
  const producido = await fetchProduccionActual(cfg.linea);
  return {
    type: 'marcador',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: {
      linea: cfg.linea ?? 'Línea 1',
      producido,
      meta: cfg.meta ?? 1000,
      porcentaje: (producido / (cfg.meta ?? 1000)) * 100,
    },
  };
}

async function fetchProduccionActual(linea?: string): Promise<number> {
  // Lógica que conecta a MES/SCADA
  return 876;
}
```

### 2. Agregar el tipo al schema

En `backend/src/db/schema.sql`, extender el CHECK:

```sql
type TEXT NOT NULL CHECK (type IN ('beneficios', ..., 'marcador'))
```

Y en `backend/src/types.ts`:

```typescript
export type WidgetType = 'beneficios' | ... | 'marcador';
```

Y en `backend/src/routes/widgets.ts` (schema de Zod):

```typescript
const widgetTypeSchema = z.enum([..., 'marcador']);
```

### 3. Registrar el builder

En `backend/src/widgets/index.ts`:

```typescript
import { buildMarcador } from './marcador';

export function registerAllWidgets() {
  // ...
  registerWidget('marcador', buildMarcador);
}
```

### 4. Crear el renderer

En `display/widgets/renderers.js`, dentro del IIFE:

```javascript
renderers.marcador = function (el, payload) {
  const d = payload?.data || {};
  el.className = 'widget widget-marcador';
  el.innerHTML = `
    <div class="header">
      <div class="title">Producción ${escapeHtml(d.linea || '')}</div>
    </div>
    <div class="body" style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px">
      <div style="font-size:72px;font-weight:800">${d.producido} / ${d.meta}</div>
      <div style="width:80%;height:20px;background:rgba(255,255,255,0.2);border-radius:10px;overflow:hidden">
        <div style="height:100%;background:#10b981;width:${Math.min(100, d.porcentaje)}%"></div>
      </div>
      <div style="font-size:24px">${Math.round(d.porcentaje)}%</div>
    </div>
  `;
};
```

### 5. Opcional: estilos

En `display/styles.css`:

```css
.widget-marcador {
  background: linear-gradient(135deg, #1e3a8a, #0f172a);
  color: white;
}
```

### 6. Registrarlo en el admin UI

En `admin/src/pages/Widgets.tsx`, agregar al `WIDGET_TYPES`:

```typescript
{ value: 'marcador', label: 'Marcador producción', icon: '🎯' },
```

Y en `defaultConfig`:

```typescript
case 'marcador': return { linea: 'Línea 1', meta: 1000 };
```

### 7. Rebuild y probar

```bash
docker compose build backend admin
docker compose up -d backend admin
```

Refrescá el admin, creá un widget del nuevo tipo, configuralo, probá el "Refresh data" y visualizalo en un layout.

---

## Tips

- **Empezá por el builder y probá aislado** con `/widgets/:id/refresh` + ver el payload antes de tocar el renderer.
- **El payload debe ser serializable** (sin funciones ni Date objects — usá strings ISO).
- **Escapear todo HTML** en el renderer (usar `escapeHtml()` que ya está en el IIFE) para evitar XSS si la data viene de fuentes no confiables.
- **TTL razonable**: para KPIs que cambian por segundo, 30-60s. Para beneficios, 5-15 min. Para cumpleaños, 1h.
- **Fetches externos deben tener timeout** — usá `AbortSignal.timeout(10_000)`.
- **Si el fetch falla**, devolvé un payload con `{ data: { error: "..." } }` para que el renderer pueda mostrar un estado degradado en vez de romper.
- **Cache local en los players**: los widgets persisten su último payload en LocalStorage, así que aún offline muestran la última info conocida.

## Widgets con data puramente estática

Si el widget no necesita fuente externa, el builder solo lee `ctx.config` y lo devuelve. Ver `texto.ts` como ejemplo mínimo.

## Widgets en tiempo real

Para data ultra-fresca (< 30s), considerá:
- Refresh agresivo (`refresh_seconds: 15`)
- O push vía `broadcast({ channel: 'all', event: { type: 'widget_update', widgetId: X } })` desde el lugar donde se genera el cambio (ej. un endpoint POST que recibe data de sensores)
