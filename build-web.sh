#!/bin/bash
set -e

echo "Building Next.js app outside Docker..."

# Navigate to web directory
cd web

# Clean previous build
rm -rf .next

# Install dependencies if needed
npm install

# Build with increased memory
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "Build completed successfully!"