# Builder stage
FROM node:18-alpine AS builder
WORKDIR /app

# Define build arguments for sensitive information
ARG MONGODB_URI

# Install dependencies
COPY package*.json ./ 
RUN npm ci

# Copy the entire source code (including web and chatbot)
COPY ./src ./src

# Copy rollup tsconfig tailwind config
COPY rollup.config.js tsconfig.json tailwind.config.js postcss.config.js ./ 

# Set Node.js memory limit for the build process (e.g., 4GB)
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Step 1: Build the web server (Next.js app)
RUN npm run build:web

# Step 2: Build the chatbot server (Rollup)
RUN npm run build:bot


# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Set environment variable from ARG
ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI

# Copy Next.js built files (web)
COPY --from=builder /app/src/web/.next ./src/web/.next

# Copy backend build files (chatbot)
COPY --from=builder /app/dist ./dist

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./ 

# Copy environment files
COPY --from=builder /app/src/chatbot/prompts ./src/chatbot/prompts

# Copy the public directory for static assets (images, etc.)
COPY --from=builder /app/src/web/public ./src/web/public

# Expose the ports for both servers
EXPOSE 3000 4000

# Run the web server first
CMD npm run start:web && npm run start:bot
