# Image size ~ 400MB
FROM node:21-alpine3.18 as builder

WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Copy all necessary files for installation
COPY . .

# Install dependencies
COPY package*.json *-lock.yaml ./

# Install build dependencies
RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
    && apk add --no-cache git \
    && pnpm install && pnpm run build \
    && apk del .gyp

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
COPY --from=builder /app/dist ./dist

# Copy json and lock files
COPY --from=builder /app/*.json /app/*-lock.yaml ./

# Copy prompts files
COPY --from=builder /app/prompts ./prompts

# Install pnpm in the deploy stage
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Install production dependencies
RUN npm cache clean --force && pnpm install --production --ignore-scripts \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && rm -rf $PNPM_HOME/.npm $PNPM_HOME/.node-gyp

# Start the application
CMD ["npm", "start"]