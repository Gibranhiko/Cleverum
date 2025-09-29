# web/Dockerfile
# ----------------------
#       Build Stage
# ----------------------
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Copy root manifests and web package
COPY package.json package-lock.json ./  
COPY web/package.json web/

# Install web workspace dependencies (npm workspace is always present, lockfile guaranteed)
RUN npm ci -w web --include-workspace-root=false --prefer-offline --no-audit --no-fund

# Copy all source code
COPY . .

WORKDIR /app/web

# Build Next.js
RUN npm run build

# ----------------------
#    Production Stage
# ----------------------
FROM node:20-alpine AS runner
WORKDIR /app/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Install only production dependencies
COPY package.json package-lock.json ../
COPY web/package.json web/
RUN npm ci -w web --omit=dev --include-workspace-root=false --prefer-offline --no-audit --no-fund

# Copy build artifacts
COPY --from=builder /app/web/.next ./.next
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/next.config.js ./next.config.js

USER nodeuser
EXPOSE 3000

CMD ["node", "../node_modules/next/dist/bin/next", "start", "-p", "3000"]
