# syntax=docker/dockerfile:1.7

# ----------------------
#       Build Stage
# ----------------------
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Copy root/workspace manifests (npm workspaces)
COPY package.json package-lock.json ./
COPY web/package.json web/package.json

# Install ONLY the web workspace deps into /app/node_modules
RUN npm ci -w web --include-workspace-root=false --prefer-offline --no-audit --no-fund \
 && npm prune --omit=dev

# Copy full source and build just web
COPY . .
WORKDIR /app/web
RUN npm run build

# ----------------------
#    Runtime Stage
# ----------------------
FROM node:20-alpine AS runner
WORKDIR /app/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Use root-level node_modules (workspace install) and run Next from web/
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/web/package.json ./package.json
COPY --from=builder /app/web/.next ./.next
COPY --from=builder /app/web/public ./public

USER nodeuser
EXPOSE 3000
# Call next binary from the parent node_modules
CMD ["node","../node_modules/next/dist/bin/next","start","-p","3000"]
