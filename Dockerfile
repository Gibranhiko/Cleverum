# Use a lightweight Node.js image for building
FROM node:18-alpine AS builder
WORKDIR /app

# Install Git for fetching dependencies
RUN apk add --no-cache git

# Define build arguments for sensitive information
ARG MONGODB_URI
ARG DO_ENDPOINT
ARG DO_ACCESS_KEY_ID
ARG DO_SECRET_ACCESS_KEY
ARG DO_BUCKET_NAME

# Set them as environment variables
ENV MONGODB_URI=$MONGODB_URI
ENV DO_ENDPOINT=$DO_ENDPOINT
ENV DO_ACCESS_KEY_ID=$DO_ACCESS_KEY_ID
ENV DO_SECRET_ACCESS_KEY=$DO_SECRET_ACCESS_KEY
ENV DO_BUCKET_NAME=$DO_BUCKET_NAME

# Copy root package.json and lockfiles before installing dependencies
COPY package.json ./ 
COPY chatbot/package.json ./chatbot/
COPY web/package.json ./web/
COPY ws/package.json ./ws/

# Ensure package.json includes workspaces before running npm install
RUN npm install --prefer-offline --no-audit --no-fund && npm cache clean --force

# Copy the rest of the application code
COPY . .

# Set Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Build ws (WebSocket server) first to avoid high memory usage
RUN npm run build:ws

# Build Next.js web app separately to avoid high memory usage
RUN npm run build:web

# Build chatbot separately to avoid high memory usage
RUN npm run build:bot

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install Git in production
RUN apk add --no-cache git

# Copy only necessary production files
COPY --from=builder /app/package.json ./ 
COPY --from=builder /app/chatbot/package.json ./chatbot/
COPY --from=builder /app/web/package.json ./web/
COPY --from=builder /app/ws/package.json ./ws/

# Copy node_modules from builder stage to production stage
COPY --from=builder /app/node_modules ./node_modules

# Copy built files from the builder stage
COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/chatbot/dist ./chatbot/dist
COPY --from=builder /app/ws/dist ./ws/dist

# Copy environment files & static assets
COPY --from=builder /app/chatbot/prompts ./chatbot/prompts

# Expose application ports (if WebSocket server and Next.js app are running on separate ports)
EXPOSE 3000 4000 5000

# Start both services in parallel (Web app and chatbot)
CMD npm run start:ws && npm run start:web & npm run start:bot
