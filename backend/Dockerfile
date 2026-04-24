FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------- builder ----------
FROM base AS builder
ENV NODE_ENV=development
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# Keep schema.sql next to dist
RUN cp src/db/schema.sql dist/db/schema.sql

# ---------- runtime ----------
FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force
COPY --from=builder /app/dist ./dist

ENV PORT=3000
EXPOSE 3000

# Data volume
RUN mkdir -p /data/uploads && chown -R node:node /data
VOLUME ["/data"]
USER node

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
