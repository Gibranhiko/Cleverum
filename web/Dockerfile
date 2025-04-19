# ----------------------
#       Build Stage
# ----------------------
    FROM node:18-alpine AS builder
    WORKDIR /app
    
    # Install Git (needed if dependencies are pulled from Git repos)
    RUN apk add --no-cache git
    
    # Copy only necessary files
    COPY ../package.json ../package-lock.json ./           
    COPY ./package.json ./                                 
    COPY ../web ./                                         
    
    # Install deps with workspace awareness
    RUN npm install --prefer-offline --no-audit --no-fund
    
    # Set memory limit to prevent crashes during build
    ENV NODE_OPTIONS="--max-old-space-size=1024"
    
    # Build the Next.js app
    RUN npm run build
    
    # ----------------------
    #    Production Stage
    # ----------------------
    FROM node:18-alpine AS production
    WORKDIR /app
    
    # Install Git if your app needs it at runtime (optional)
    RUN apk add --no-cache git
    
    # Copy production files
    COPY --from=builder /app/package.json ./
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/.next ./.next
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/next.config.js ./next.config.js
    
    # Set production environment
    ENV NODE_ENV=production
    
    EXPOSE 3000
    
    # Start the app
    CMD ["npm", "start"]
    