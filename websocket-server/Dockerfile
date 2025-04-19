# ----------------------
#       Build Stage
# ----------------------
    FROM node:18-alpine AS builder
    WORKDIR /app
    
    # Install Git if needed (for deps)
    RUN apk add --no-cache git
    
    # Copy workspace-related files
    COPY ../package.json ../package-lock.json ./
    COPY ./package.json ./                             
    COPY ../websocket-server ./                        
    
    # Install deps with workspace awareness
    RUN npm install --prefer-offline --no-audit --no-fund
    
    # Build the app (if using TypeScript or bundler)
    RUN npm run build
    
    # ----------------------
    #    Production Stage
    # ----------------------
    FROM node:18-alpine AS production
    WORKDIR /app
    
    # Install Git in case runtime needs it
    RUN apk add --no-cache git
    
    # Copy necessary runtime files
    COPY --from=builder /app/package.json ./
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/dist ./dist               # Assumes build output is in `dist/`
    
    # Environment setup (adjust as needed)
    ENV NODE_ENV=production
    EXPOSE 5000
    
    # Start the websocket server
    CMD ["node", "dist/index.js"]
    