# ----------------------
#    Production Stage (Pre-built)
# ----------------------
FROM node:18-alpine AS production
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm install --prefer-offline --no-audit --no-fund --only=production

# Copy pre-built Next.js files (built outside Docker with build-web.sh)
COPY .next ./.next
COPY public ./public

# Copy necessary config files
COPY next.config.cjs ./
COPY postcss.config.js ./postcss.config.js
COPY tailwind.config.js ./tailwind.config.js

# Set environment
ENV NODE_ENV=production

EXPOSE 3000

# Start Next.js
CMD ["npm", "start"]
