# Base Stage for Dependencies
FROM node:18-alpine AS base
WORKDIR /app

# Define build arguments for sensitive information
ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy common configurations
COPY rollup.config.js tsconfig.json tailwind.config.js postcss.config.js ./

# Build Stage for the Server
FROM base AS server-builder

# Copy the server source code
COPY ./src ./src

# Build the server (Rollup)
RUN npm run build:server

# Build Stage for the Client-Admin
FROM base AS client-builder

# Copy the client-admin source code
COPY ./src/client-admin ./src/client-admin

# Build the client-admin (Next.js)
WORKDIR /app/src/client-admin
RUN npm run build

# Production Stage
FROM node:18-alpine AS production
WORKDIR /app

# Set environment variable from ARG
ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI

# Copy backend build files (server)
COPY --from=server-builder /app/dist ./dist

# Copy client-admin built files (Next.js)
COPY --from=client-builder /app/src/client-admin/.next ./src/client-admin/.next

# Copy production dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy the public directory for static assets (images, etc.)
COPY ./src/client-admin/public ./src/client-admin/public

# Copy chatbot-related files (e.g., prompts)
COPY ./src/chatbot/prompts ./src/chatbot/prompts

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
