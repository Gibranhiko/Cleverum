# syntax=docker/dockerfile:1.7

############################
# Build deps (workspace-aware)
############################
FROM node:20-alpine AS deps
WORKDIR /app

# For sharp prebuilt compatibility on Alpine
RUN apk add --no-cache libc6-compat

# Install pnpm
RUN npm install -g pnpm

# Copy only manifests (cache-friendly)
COPY package.json pnpm-lock.yaml ./
COPY chatbot/package.json chatbot/package.json

# Install deps for the workspace (with dev deps for build)
RUN pnpm install --frozen-lockfile

############################
# Build chatbot
############################
FROM deps AS builder
# Bring full source now
COPY . .
WORKDIR /app
RUN pnpm --filter chatbot run build

############################
# Runtime (prod deps only)
############################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# For sharp prebuilt compatibility
RUN apk add --no-cache libc6-compat

# Install pnpm
RUN npm install -g pnpm

# Install ONLY production deps for chatbot
COPY package.json pnpm-lock.yaml ./
COPY chatbot/package.json chatbot/package.json
RUN pnpm install --frozen-lockfile --prod

# App files
WORKDIR /app/chatbot
COPY --from=builder /app/chatbot/dist ./dist
# If you have other runtime assets alongside dist, copy them here.

# Run as non-root
RUN addgroup -S nodejs && adduser -S -u 1001 nodejs -G nodejs
USER nodejs

CMD ["node","./dist/app.js"]
