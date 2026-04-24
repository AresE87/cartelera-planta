# Contribuir

## Setup dev

```bash
git clone https://github.com/AresE87/cartelera-planta.git
cd cartelera-planta

# Backend
cd backend
npm install
cp ../.env.example ../.env
npm run dev        # tsx watch con hot reload

# Admin (otra terminal)
cd ../admin
npm install
npm run dev        # Vite dev server :5173

# Display
# Abrir directo en el browser: file:///...display/index.html
# O servirlo vía backend con `npm run dev` arriba
```

## Convenciones

- **Commits:** `type(scope): mensaje` — `feat`, `fix`, `docs`, `refactor`, `chore`
- **Branches:** `feat/...`, `fix/...`, `docs/...`
- **PR:** título corto, cuerpo con "Por qué" (no solo "qué")
- **Lint:** TypeScript strict, sin warnings nuevos

## Antes de PR

```bash
# Backend
cd backend && npm run typecheck && npm run build && npm test

# Admin
cd admin && npm run typecheck && npm run build

# Local smoke
bash scripts/validate.sh
```

Opcional (si tenés Docker):
```bash
docker compose up -d --build
BASE_URL=http://localhost:8080 bash scripts/smoke-test.sh
docker compose down
```

## Estructura de un cambio

1. Crear branch desde `main`
2. Cambios chicos y enfocados (un PR = un tema)
3. Actualizar docs si es user-visible
4. Actualizar `docs/changelog.md` si es breaking / feature importante
5. PR con descripción clara
