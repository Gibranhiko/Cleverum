# ----------------------
#       Build Stage
# ----------------------
FROM node:18-alpine AS builder
WORKDIR /app

# Copy only necessary files for install first (cache optimization)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --prefer-offline --no-audit --no-fund

# Copy remaining files
COPY . .

# Set Node.js memory limit for build process
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Build the Next.js app
RUN npm run build

# ----------------------
#    Production Stage
# ----------------------
FROM node:18-alpine AS production
WORKDIR /app

# Copy necessary files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

# Optional: Tailwind CSS config (if needed)
COPY --from=builder /app/postcss.config.js ./postcss.config.js
COPY --from=builder /app/tailwind.config.js ./tailwind.config.js

# Set memory limit in production too (optional)
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NODE_ENV=production

EXPOSE 3000

# Start Next.js
CMD ["npm", "start"]
