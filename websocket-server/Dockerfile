# ----------------------
#       Build Stage
# ----------------------
    FROM node:18-alpine AS builder
    WORKDIR /app
    
    # Install git if needed (for private dependencies)
    RUN apk add --no-cache git
    
    # Copy package files and install dependencies
    COPY package.json package-lock.json ./
    RUN npm install --prefer-offline --no-audit --no-fund
    
    # Copy the rest of the app (TypeScript sources, tsconfig, etc.)
    COPY . .
    
    # Compile TypeScript to JavaScript
    RUN npm run build
    
    # ----------------------
    #    Production Stage
    # ----------------------
    FROM node:18-alpine AS production
    WORKDIR /app
    
    # Optional: install git if runtime needs it
    RUN apk add --no-cache git
    
    # Copy only what's needed for runtime
    COPY --from=builder /app/package.json ./
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/dist ./dist
    
    # Set environment variables (optional)
    ENV NODE_ENV=production
    
    # Expose WebSocket server port
    EXPOSE 5000
    
    # Start the WebSocket server
    CMD ["node", "dist/index.js"]
    