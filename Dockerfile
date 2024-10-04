# Builder stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./ 
RUN npm ci

# Copy environment files
COPY .env.local .env.local
COPY ./src/client-admin/.env.local ./src/client-admin/.env.local

# Copy the entire source code (including client-admin and chatbot)
COPY ./src ./src

# Build Next.js client-admin app
RUN npm run build:client-admin

# Build backend with Rollup
COPY rollup.config.js tsconfig.json ./ 
RUN npm run build:server

# Production stage
FROM node:18-alpine AS production
ENV NODE_ENV=production

WORKDIR /app

# Copy Next.js built files (client-admin)
COPY --from=builder /app/src/client-admin/.next ./src/client-admin/.next

# Copy backend build files (dist)
COPY --from=builder /app/dist ./dist

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy environment files
COPY --from=builder /app/.env.local .env.local
COPY --from=builder /app/src/client-admin/.env.local ./src/client-admin/.env.local
COPY --from=builder /app/src/chatbot/prompts ./src/chatbot/prompts

# Expose the port your app runs on
EXPOSE 3000

# Start the application (backend)
CMD ["npm", "start"]
