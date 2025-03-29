# Use a lightweight Node.js image
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

# Copy package.json and lockfiles before installing dependencies
COPY package*.json ./
COPY ./chatbot/package*.json ./chatbot/
COPY ./web/package*.json ./web/

# Install dependencies
RUN npm install --prefer-offline --no-audit --no-fund && npm cache clean --force

# Copy the rest of the application code
COPY . .

# Set Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Build Next.js web app separately to avoid high memory usage
RUN npm run build:web

# Build chatbot separately to avoid high memory usage
RUN npm run build:bot

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Copy built files from the builder stage
COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/chatbot/dist ./chatbot/dist

# Copy only necessary production files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy environment files & static assets
COPY --from=builder /app/chatbot/prompts ./chatbot/prompts

# Expose application ports
EXPOSE 3000 4000

# Start both services in parallel
CMD npm run start:web & npm run start:bot
