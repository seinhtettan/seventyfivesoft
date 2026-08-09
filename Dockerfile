# ---- dependencies ----------------------------------------------------------
FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# ---- build -----------------------------------------------------------------
FROM dependencies AS build

COPY . .
RUN npm run build

# ---- production dependencies -----------------------------------------------
FROM node:22-bookworm-slim AS production-dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci --omit=dev \
    && npm cache clean --force \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# ---- runtime ---------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/seventyfivesoft.sqlite \
    STATIC_ROOT=/app/dist

WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-server ./dist-server
COPY --from=build --chown=node:node /app/package.json ./package.json

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD ["node", "-e", "const port=process.env.PORT??8080;fetch(`http://127.0.0.1:${port}/healthz`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist-server/index.js"]
