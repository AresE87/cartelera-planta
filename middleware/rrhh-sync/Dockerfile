FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY index.js ./
COPY data ./data
EXPOSE 4001
CMD ["node", "index.js"]
