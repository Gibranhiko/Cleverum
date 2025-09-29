# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder
WORKDIR /app

# disable telemetry and give Node more memory for the build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"

# copy only lockfiles + package manifests needed for workspace install (speeds layer caching)
COPY package.json package-lock.json* ./
# install web workspace WITH dev deps (needed for build tools like postcss)
RUN npm ci -w web --include-workspace-root=false --prefer-offline --no-audit --no-fund

# copy sources
COPY . .

# build inside the web workspace
WORKDIR /app/web
RUN npm run build

# ----------------------
# Runtime image
# ----------------------
FROM node:20-alpine AS runner
WORKDIR /app/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# runtime memory limit (optional, lower than build)
ENV NODE_OPTIONS="--max-old-space-size=1024"

# create non-root user for safety
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Install only production deps for web workspace (keeps image small)
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci -w web --omit=dev --include-workspace-root=false --prefer-offline --no-audit --no-fund

# copy built assets from builder
COPY --from=builder /app/web/.next /app/web/.next
COPY --from=builder /app/web/next.config.js /app/web/next.config.js
# (optionally copy other files needed at runtime like .env.production or next-i18next config)

WORKDIR /app/web
USER nodeuser
EXPOSE 3000
CMD ["node", "../node_modules/next/dist/bin/next", "start", "-p", "3000"]
