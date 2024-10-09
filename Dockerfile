# Builder stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./ 
RUN npm ci

# Copy the entire source code (including client-admin and chatbot)
COPY ./src ./src

# Copy rollup tsconfig tailwind config
COPY rollup.config.js tsconfig.json tailwind.config.js postcss.config.js ./ 

# Build Nnext app and server
RUN npm run build

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
COPY --from=builder /app/src/chatbot/prompts ./src/chatbot/prompts

# Copy the public directory for static assets (images, etc.)
COPY --from=builder /app/src/client-admin/public ./src/client-admin/public

# Expose the port your app runs on
EXPOSE 3000

# Start the application (backend)
CMD ["npm", "start"]
