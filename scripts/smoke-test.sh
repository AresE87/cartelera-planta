#!/usr/bin/env bash
# -------------------------------------------------------------------
# Cartelera Planta — smoke test end-to-end contra una instancia levantada
#
# Uso: BASE_URL=http://localhost:8080 bash scripts/smoke-test.sh
# -------------------------------------------------------------------
set -euo pipefail

BASE="${BASE_URL:-http://localhost:8080}"
EMAIL="${EMAIL:-admin@cartelera.local}"
PASSWORD="${PASSWORD:-admin1234}"

GREEN=$'\e[1;32m'; RED=$'\e[1;31m'; RESET=$'\e[0m'
ok()  { echo -e "${GREEN}✓${RESET} $*"; }
bad() { echo -e "${RED}✗${RESET} $*"; exit 1; }

echo "Smoke test contra $BASE"

# 1. Health
res=$(curl -sS "$BASE/api/health")
echo "$res" | grep -q '"ok":true' && ok "Health OK" || bad "Health falló: $res"

# 2. Login
TOKEN=$(curl -sS -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | \
  node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).token)}catch{process.exit(1)}})')
[[ -n "$TOKEN" ]] && ok "Login OK (token length: ${#TOKEN})" || bad "Login falló"

H="Authorization: Bearer $TOKEN"

# 3. /me
res=$(curl -sS -H "$H" "$BASE/api/auth/me")
echo "$res" | grep -q "\"email\":\"$EMAIL\"" && ok "me OK" || bad "me falló: $res"

# 4. Lists
for resource in zones displays widgets layouts schedules alerts; do
  res=$(curl -sS -H "$H" "$BASE/api/$resource")
  echo "$res" | grep -qE '"(zones|displays|widgets|layouts|schedules|alerts)":' && ok "GET /$resource OK" || bad "GET /$resource falló: $res"
done

# 5. Create a test alert + dismiss
res=$(curl -sS -X POST -H "$H" -H 'content-type: application/json' \
  -d '{"title":"Smoke test","severity":"info","target_type":"all","duration_seconds":5}' \
  "$BASE/api/alerts")
ALERT_ID=$(echo "$res" | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).id)}catch{process.exit(1)}})')
[[ -n "$ALERT_ID" ]] && ok "Alerta creada (id=$ALERT_ID)" || bad "Crear alerta falló: $res"

curl -sS -X POST -H "$H" "$BASE/api/alerts/$ALERT_ID/dismiss" | grep -q '"ok":true' && ok "Alerta cerrada" || bad "Dismiss falló"

# 6. Static routes (basic reachability)
for path in /admin/ /display/ /api/health; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE$path")
  if [[ "$code" == "200" ]]; then
    ok "$path → 200"
  elif [[ "$code" == "304" ]]; then
    ok "$path → 304 (cache)"
  else
    bad "$path → $code (esperado 200)"
  fi
done

echo ""
echo "${GREEN}✅ Todos los checks pasaron.${RESET}"
