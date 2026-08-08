# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Copied separately so the dependency layer survives source-only changes
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# `npm run build` is `tsc -b && vite build`, so a type error fails the image
RUN npm run build

# ---- serve ----------------------------------------------------------------
# Unprivileged variant: already runs as uid 101 and listens on 8080, which
# keeps it working under a restricted PodSecurity policy without extra fuss.
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
