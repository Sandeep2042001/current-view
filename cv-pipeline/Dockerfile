FROM node:18-alpine

WORKDIR /app

# Install system dependencies for basic image processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cmake \
    pkgconfig \
    libc6-compat \
    libjpeg-turbo-dev \
    libpng-dev \
    libwebp-dev \
    wget \
    unzip \
    bash

# For now, we'll use a simpler approach without full OpenCV compilation
# This can be enhanced later with proper OpenCV installation

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["npm", "start"]
