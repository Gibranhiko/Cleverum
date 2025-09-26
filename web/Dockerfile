# syntax=docker/dockerfile:1.7

# ----------------------
#       Build Stage
# ----------------------
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Copy workspace manifests (need root lockfile!)
COPY package.json package-lock.json ./
COPY web/package.json web/package.json

# Install web workspace WITH dev deps (needed for postcss/autoprefixer)
RUN npm ci -w web --include-workspace-root=false --prefer-offline --no-audit --no-fund

# Copy the rest and build web
COPY . .
WORKDIR /app/web
RUN npm run build

# ----------------------
#       Runtime Stage
# ----------------------
FROM node:20-alpine AS runner
WORKDIR /app/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Non-root user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Install ONLY production deps for web workspace
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
RUN npm ci -w web --omit=dev --include-workspace-root=false --prefer-offline --no-audit --no-fund

# Bring built assets
COPY --from=builder /app/web/.next /app/web/.next

WORKDIR /app/web
USER nodeuser
EXPOSE 3000
# Start Next.js (no standalone)
CMD ["node", "../node_modules/next/dist/bin/next", "start", "-p", "3000"]
