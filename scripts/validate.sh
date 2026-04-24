#!/usr/bin/env bash
# -------------------------------------------------------------------
# Cartelera Planta — validación integral local
# Ejecuta el mismo set de checks que el CI, pero en tu máquina.
# -------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GREEN=$'\e[1;32m'
RED=$'\e[1;31m'
YELLOW=$'\e[1;33m'
RESET=$'\e[0m'

PASS=0
FAIL=0
WARN=0

ok()   { echo -e "${GREEN}✓${RESET} $*"; PASS=$((PASS+1)); }
bad()  { echo -e "${RED}✗${RESET} $*"; FAIL=$((FAIL+1)); }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; WARN=$((WARN+1)); }

echo "Cartelera Planta — validación local"
echo "===================================="
echo ""

# 1. Structure
echo "→ Validando estructura del repo..."
for f in README.md plan.md LICENSE .gitignore docker-compose.yml Caddyfile .env.example \
         backend/package.json backend/src/index.ts backend/Dockerfile \
         admin/package.json admin/src/main.tsx admin/Dockerfile \
         display/index.html display/player.js display/sw.js \
         scripts/install-ubuntu.sh scripts/backup.sh scripts/restore.sh; do
  if [[ -f "$f" ]]; then ok "$f existe"; else bad "FALTA: $f"; fi
done
echo ""

# 2. Backend
echo "→ Validando backend..."
cd backend
if [[ -f package.json ]]; then
  if npm install --no-audit --no-fund --silent 2>/dev/null; then
    ok "backend: deps instalables"
  else
    warn "backend: npm install falló (¿sin red? probá online)"
  fi

  if command -v node >/dev/null; then
    if node -e "require('typescript')" 2>/dev/null; then
      if npx -y tsc -p tsconfig.json --noEmit 2>/dev/null; then
        ok "backend: typecheck OK"
      else
        warn "backend: typecheck reportó issues (correr 'npm run typecheck' para detalle)"
      fi
    fi
  fi
fi
cd "$ROOT"
echo ""

# 3. Admin
echo "→ Validando admin..."
cd admin
if [[ -f package.json ]]; then
  if npm install --no-audit --no-fund --silent 2>/dev/null; then
    ok "admin: deps instalables"
  else
    warn "admin: npm install falló"
  fi
fi
cd "$ROOT"
echo ""

# 4. Display (syntax)
echo "→ Validando display client..."
if command -v node >/dev/null; then
  for f in display/player.js display/widgets/renderers.js display/sw.js; do
    if node --check "$f" 2>/dev/null; then
      ok "$(basename "$f"): sintaxis OK"
    else
      bad "$(basename "$f"): error de sintaxis"
    fi
  done
fi
if grep -q '<!DOCTYPE html>' display/index.html; then
  ok "display/index.html: DOCTYPE presente"
else
  bad "display/index.html: sin DOCTYPE"
fi
echo ""

# 5. Middleware
echo "→ Validando middleware..."
for dir in rrhh-sync produccion-adapter seguridad-feed; do
  d="middleware/$dir"
  if [[ -f "$d/index.js" && -f "$d/package.json" && -f "$d/Dockerfile" ]]; then
    if node --check "$d/index.js" 2>/dev/null; then
      ok "middleware/$dir: completo y válido"
    else
      bad "middleware/$dir: index.js tiene errores"
    fi
  else
    bad "middleware/$dir: archivos faltantes"
  fi
done
echo ""

# 6. Docker compose
echo "→ Validando docker-compose..."
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  if docker compose config -q 2>/dev/null; then
    ok "docker-compose.yml: sintaxis OK"
  else
    bad "docker-compose.yml: error de sintaxis"
  fi
else
  warn "Docker no disponible — salteo validación de compose"
fi
echo ""

# 7. Caddyfile
echo "→ Validando Caddyfile..."
if command -v docker >/dev/null; then
  if docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine \
       caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null; then
    ok "Caddyfile válido"
  else
    warn "Caddy no pudo validar (¿sin imagen pullada?)"
  fi
else
  warn "Docker no disponible — salteo Caddyfile"
fi
echo ""

# 8. Scripts shell
echo "→ Validando scripts shell..."
for s in scripts/*.sh; do
  if bash -n "$s" 2>/dev/null; then
    ok "$(basename "$s"): sintaxis OK"
  else
    bad "$(basename "$s"): error de sintaxis"
  fi
done
echo ""

# 9. Docs
echo "→ Validando docs..."
docs_referenced=(architecture.md install-guide.md user-manual.md admin-guide.md api-reference.md widget-development.md operations.md security.md changelog.md)
for d in "${docs_referenced[@]}"; do
  if [[ -f "docs/$d" ]]; then ok "docs/$d existe"; else bad "FALTA docs/$d"; fi
done
echo ""

# 10. .env.example vs backend config
echo "→ Validando .env.example..."
for v in JWT_SECRET DB_PATH UPLOADS_DIR ADMIN_EMAIL ADMIN_PASSWORD PUBLIC_URL; do
  if grep -q "^${v}=" .env.example; then ok ".env.example tiene $v"; else bad ".env.example falta $v"; fi
done
echo ""

# Summary
echo "===================================="
echo "Resultados: ${GREEN}${PASS} OK${RESET}, ${YELLOW}${WARN} warnings${RESET}, ${RED}${FAIL} fallos${RESET}"
echo ""
if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
