# Use a specific Node.js version for the build stage
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of your app code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS deploy

# Set NODE_ENV to production
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy only the necessary files from the builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/rollup.config.js ./

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK CMD curl --fail http://localhost:3000/ || exit 1

# Command to run the application
CMD ["npm", "start"]
