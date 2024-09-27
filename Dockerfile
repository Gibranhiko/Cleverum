# Use Node.js 18 with Alpine for a smaller image
FROM node:21-alpine3.18 as builder

# Set working directory
WORKDIR /app

COPY package*.json ./

# Copy the rest of your app code (including package.json and package-lock.json)
COPY . .

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Set NODE_ENV to production for runtime
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
