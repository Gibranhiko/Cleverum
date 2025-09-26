# ----------------------
#       Build Stage
# ----------------------
FROM node:20-alpine AS builder
WORKDIR /app

# System deps that sometimes help sharp/canvas; comment if not needed
# RUN apk add --no-cache libc6-compat python3 make g++ pkgconfig

# Copy manifests first for better cache
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

# Copy source
COPY . .

# Ensure a modest Node heap during build on small hosts
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Produce standalone build (server needs only the output)
# (in next.config.js set: output: 'standalone')
RUN npm run build

# ----------------------
#    Production Stage
# ----------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Small heap in runtime is fine
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Copy only the standalone output and public assets
# After `output: 'standalone'`, Next puts a self-contained server in .next/standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nodeuser
EXPOSE 3000

# Start the server from the standalone entrypoint
CMD ["node", "server.js"]
