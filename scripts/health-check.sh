#!/usr/bin/env bash
# Cartelera health check — prints a status summary.
set -e
URL="${URL:-http://localhost:8080}"

echo "→ Cartelera health check @ $URL"
echo ""

echo "1. Backend API:"
curl -sS "$URL/api/health" | python3 -m json.tool 2>/dev/null || echo "  ❌ failed"
echo ""

echo "2. Admin UI (HTTP 200 expected):"
code=$(curl -s -o /dev/null -w "%{http_code}" "$URL/admin/")
echo "  HTTP $code $([ "$code" = "200" ] && echo '✅' || echo '❌')"
echo ""

echo "3. Display client:"
code=$(curl -s -o /dev/null -w "%{http_code}" "$URL/display/")
echo "  HTTP $code $([ "$code" = "200" ] && echo '✅' || echo '❌')"
echo ""

echo "4. Containers:"
docker compose ps 2>/dev/null || docker ps --filter "name=cartelera"
