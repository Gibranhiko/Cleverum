# web/Dockerfile  — simple single-app build (no npm workspaces)
FROM node:18-alpine AS builder
WORKDIR /app

# copy only web manifests (context: ./web)
COPY package.json package-lock.json* ./

# install deps (non-deterministic compared to npm ci with lockfile at root,
# but matches the "it worked before" behavior)
RUN npm install --prefer-offline --no-audit --no-fund

# copy app sources
COPY . .

# increase memory for build step to avoid OOM if needed
ENV NODE_OPTIONS="--max-old-space-size=2048"

# build Next.js app
RUN npm run build

# -------- runtime stage --------
FROM node:18-alpine AS production
WORKDIR /app

# copy necessary artifacts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"

EXPOSE 3000
CMD ["npm", "start"]
