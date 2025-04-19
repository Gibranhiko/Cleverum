# ----------------------
#       Build Stage
# ----------------------
    FROM node:18-alpine AS builder
    WORKDIR /app
    
    # Install Git (if any Git-based deps)
    RUN apk add --no-cache git
    
    # Copy only necessary files for install first (cache optimization)
    COPY package.json package-lock.json* ./
    
    # Install dependencies
    RUN npm install --prefer-offline --no-audit --no-fund
    
    # Copy remaining files
    COPY . .

    # Set Node.js memory limit for the build process (e.g., 4GB)
    ENV NODE_OPTIONS="--max-old-space-size=1024"
    
    # Build the Next.js app
    RUN npm run build
    
    # ----------------------
    #    Production Stage
    # ----------------------
    FROM node:18-alpine AS production
    WORKDIR /app
    
    # Install git if needed at runtime (optional)
    RUN apk add --no-cache git
    
    # Only copy necessary files
    COPY --from=builder /app/package.json ./
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/.next ./.next
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/next.config.js ./next.config.js
    
    # Optional: if using Tailwind CSS with custom postcss config
    COPY --from=builder /app/postcss.config.js ./postcss.config.js
    COPY --from=builder /app/tailwind.config.js ./tailwind.config.js
    
    # Set environment
    ENV NODE_ENV=production
    
    EXPOSE 3000
    
    # Start the Next.js server
    CMD ["npm", "start"]
    