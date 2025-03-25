# Builder stage
FROM node:18-alpine AS builder
WORKDIR /app

# Install Git for fetching dependencies
RUN apk add --no-cache git

# Define build arguments for sensitive information
ARG MONGODB_URI

# Copy the root package.json and the workspace package.json files
COPY package*.json ./
COPY ./chatbot/package*.json ./chatbot/
COPY ./web/package*.json ./web/

# Install dependencies for the root project, which includes chatbot and web workspaces
RUN npm install

# Copy the source code for both chatbot and web
COPY ./chatbot ./chatbot
COPY ./web ./web

# Copy Rollup config (chatbot)
COPY ./chatbot/rollup.config.js ./chatbot/rollup.config.js

# Copy TypeScript config files (chatbot and web)
COPY ./chatbot/tsconfig.json ./chatbot/tsconfig.json
COPY ./web/tsconfig.json ./web/tsconfig.json

# Copy Tailwind and PostCSS config (web)
COPY ./web/tailwind.config.js ./web/tailwind.config.js
COPY ./web/postcss.config.js ./web/postcss.config.js

# Set Node.js memory limit for the build process
ENV NODE_OPTIONS="--max-old-space-size=512"

# Build the web server (Next.js app) first
RUN npm run build:web

# Build the chatbot server (Rollup) after web is done
RUN npm run build:bot


# Production stage (cleaner image without Git)
FROM node:18-alpine AS production
WORKDIR /app

# Set environment variable from ARG
ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI

# Copy Next.js built files (web)
COPY --from=builder /app/web/.next ./web/.next

# Copy backend build files (chatbot)
COPY --from=builder /app/chatbot/dist ./chatbot/dist

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./ 

# Copy environment files
COPY --from=builder /app/chatbot/prompts ./chatbot/prompts

# Copy the public directory for static assets (images, etc.)
COPY --from=builder /app/web/public ./web/public

# Expose the ports for both servers
EXPOSE 3000 4000

# Run one after the other: first web, then bot
CMD npm run start:web && sleep 5 && npm run start:bot
