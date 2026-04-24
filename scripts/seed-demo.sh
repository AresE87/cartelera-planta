#!/usr/bin/env bash
# Runs the backend seed script inside the running container
set -e
docker exec -it cartelera-backend node dist/seed.js || docker exec -it cartelera-backend npx tsx src/seed.ts
