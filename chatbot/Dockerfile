# Image size ~ 400MB
FROM node:21-alpine3.18 as builder

WORKDIR /app

# Copy all necessary files for installation
COPY package*.json *-lock.json ./

# Install build dependencies
RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
    && apk add --no-cache git \
    && npm ci \
    && apk del .gyp

# Copy source code
COPY . .

# Build the chatbot
RUN cd chatbot && npm run build

# ----------------------------
# Deployment Stage
# ----------------------------

FROM node:21-alpine3.18 as deploy

WORKDIR /app

# Argument for PORT
ARG PORT=4000
ENV PORT $PORT
EXPOSE $PORT

# Copy built files from the builder stage
COPY --from=builder /app/chatbot/dist ./dist

# Copy json and lock files
COPY --from=builder /app/package*.json /app/*-lock.json ./

# Copy prompts files
COPY --from=builder /app/chatbot/prompts ./prompts

# Install production dependencies
RUN npm ci --only=production \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs

# Start the application
CMD ["npm", "start"]