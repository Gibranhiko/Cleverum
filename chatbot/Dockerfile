# syntax=docker/dockerfile:1.7

############################
# Deps (workspace-aware)
############################
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
# sharp prebuilt sometimes needs this on alpine
RUN apk add --no-cache libc6-compat

# Copy only manifests for cache-friendly installs
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY chatbot/package.json chatbot/package.json

# Pre-fetch store, then materialize deps ONLY for chatbot
RUN pnpm fetch
RUN pnpm -w install --filter ./chatbot --frozen-lockfile

############################
# Build chatbot
############################
FROM deps AS builder
# Bring full source for build
COPY . .
WORKDIR /app/chatbot
# Build with dev deps present
RUN pnpm build

############################
# Runtime (slim, prod deps only)
############################
FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Install ONLY production deps for chatbot (do NOT ignore scripts)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY chatbot/package.json chatbot/package.json
RUN pnpm -w install --filter ./chatbot --frozen-lockfile --prod

# App files
WORKDIR /app/chatbot
COPY --from=builder /app/chatbot/dist ./dist
# If you have prompts or other runtime assets:
# COPY --from=builder /app/chatbot/prompts ./prompts

# Run as non-root
RUN addgroup -S nodejs && adduser -S -u 1001 nodejs -G nodejs
USER nodejs

CMD ["node","./dist/app.js"]
