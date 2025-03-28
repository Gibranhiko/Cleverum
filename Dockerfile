# Builder stage
FROM node:18-alpine AS builder
WORKDIR /app

# Install Git for fetching dependencies
RUN apk add --no-cache git

# Define build arguments for sensitive information
ARG MONGODB_URI

# Copy package.json and lockfiles
COPY package*.json ./
COPY ./chatbot/package*.json ./chatbot/
COPY ./web/package*.json ./web/

# Install dependencies efficiently (for low RAM)
RUN npm ci --prefer-offline --no-audit --no-fund \
    && npm cache clean --force

# Copy source code
COPY ./chatbot ./chatbot
COPY ./web ./web

# Copy configuration files
COPY ./chatbot/rollup.config.js ./chatbot/rollup.config.js
COPY ./chatbot/tsconfig.json ./chatbot/tsconfig.json
COPY ./web/tsconfig.json ./web/tsconfig.json
COPY ./web/tailwind.config.js ./web/tailwind.config.js
COPY ./web/postcss.config.js ./web/postcss.config.js

# Set Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Build Next.js web app
RUN npm run build:web

# Build chatbot
RUN npm run build:bot


# Production stage (cleaner image)
FROM node:18-alpine AS production
WORKDIR /app

# Build arguments
ARG DO_ENDPOINT
ARG DO_ACCESS_KEY_ID
ARG DO_SECRET_ACCESS_KEY
ARG DO_BUCKET_NAME

# Set them as environment variables
ENV DO_ENDPOINT=$DO_ENDPOINT
ENV DO_ACCESS_KEY_ID=$DO_ACCESS_KEY_ID
ENV DO_SECRET_ACCESS_KEY=$DO_SECRET_ACCESS_KEY
ENV DO_BUCKET_NAME=$DO_BUCKET_NAME

# Copy built files from builder stage
COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/chatbot/dist ./chatbot/dist

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy environment files & static assets
COPY --from=builder /app/chatbot/prompts ./chatbot/prompts
COPY --from=builder /app/web/public ./web/public

# Expose ports
EXPOSE 3000 4000

# Start both services in parallel
CMD npm run start:web & npm run start:bot
