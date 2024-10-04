# Builder stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy environment files
COPY ./src/client-admin/.env.local ./src/client-admin/.env.local
COPY .env.local .env.local

# Copy the entire source code, including both client-admin and chatbot
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

# Copy Next.js built files
COPY --from=builder /app/src/client-admin/.next ./src/client-admin/.next

# Copy backend build files
COPY --from=builder /app/dist ./dist

# Copy necessary production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src

EXPOSE 3000
CMD ["npm", "start"]
