# syntax=docker/dockerfile:1.7

# ----------------------
#       Build Stage
# ----------------------
FROM node:20-alpine AS builder
WORKDIR /app

# (Optional) helps some native deps like sharp/canvas
# RUN apk add --no-cache libc6-compat python3 make g++ pkgconfig

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Copy only what's needed for dependency resolution
COPY package.json package-lock.json ./
COPY web/package.json web/package.json

# Install ONLY the web workspace deps (needs root lockfile)
RUN npm ci -w web --include-workspace-root=false --prefer-offline --no-audit --no-fund

# Now bring in the full source tree and build just web
COPY . .
WORKDIR /app/web
RUN npm run build

# ----------------------
#    Production Stage
#    (Next.js standalone)
# ----------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Non-root user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# If next.config.js has:  module.exports = { output: 'standalone', swcMinify: true }
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

USER nodeuser
EXPOSE 3000
CMD ["node", "server.js"]
