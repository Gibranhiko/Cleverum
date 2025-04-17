# ---------------------- #
#       Build Stage      #
# ---------------------- #
FROM node:18-alpine AS builder
WORKDIR /app

# Install Git for fetching dependencies
RUN apk add --no-cache git

# Copy root package.json and lockfiles before installing dependencies
COPY package.json ./ 
COPY package-lock.json ./
COPY chatbot/package.json ./chatbot/
# COPY web/package.json ./web/
# COPY websocket-server/package.json ./websocket-server/

# Ensure package.json includes workspaces before running npm install
RUN npm install --prefer-offline --no-audit --no-fund && npm cache clean --force

# Copy the rest of the application code
COPY . .

# Set Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Build ws (WebSocket server) first to avoid high memory usage
# RUN npm run build:ws

# Build Next.js web app separately to avoid high memory usage
# RUN npm run build:web

# Build chatbot separately to avoid high memory usage
RUN npm run build:bot

# ---------------------- #
#    Production Stage    #
# ---------------------- #
FROM node:18-alpine AS production
WORKDIR /app

# Install Git in production
RUN apk add --no-cache git

# Copy only necessary production files
COPY --from=builder /app/package.json ./ 
COPY --from=builder /app/chatbot/package.json ./chatbot/
# COPY --from=builder /app/web/package.json ./web/
# COPY --from=builder /app/websocket-server/package.json ./websocket-server/

# Install only production dependencies
RUN npm install --omit=dev --prefer-offline --no-audit --no-fund && npm cache clean --force

# Copy built files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/chatbot/dist ./chatbot/dist
# COPY --from=builder /app/websocket-server/dist ./websocket-server/dist

# Copy environment files & static assets
COPY --from=builder /app/chatbot/prompts ./chatbot/prompts

# Expose application ports (Next.js and chatbot)
# EXPOSE 3000 4000
EXPOSE 4000

# Start both services in parallel using 'concurrently'
CMD ["npm", "start"]
