FROM node:18-alpine

WORKDIR /app

# Install system dependencies for OpenCV and image processing
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
    libtiff-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libgtk-3-dev \
    libatlas-base-dev \
    gfortran \
    wget \
    unzip

# Install OpenCV
RUN wget -O opencv.zip https://github.com/opencv/opencv/archive/4.8.0.zip && \
    unzip opencv.zip && \
    cd opencv-4.8.0 && \
    mkdir build && \
    cd build && \
    cmake -D CMAKE_BUILD_TYPE=RELEASE \
          -D CMAKE_INSTALL_PREFIX=/usr/local \
          -D INSTALL_PYTHON_EXAMPLES=OFF \
          -D INSTALL_C_EXAMPLES=OFF \
          -D OPENCV_ENABLE_NONFREE=ON \
          -D OPENCV_EXTRA_MODULES_PATH=../../opencv_contrib-4.8.0/modules \
          -D PYTHON_EXECUTABLE=/usr/bin/python3 \
          -D BUILD_EXAMPLES=OFF .. && \
    make -j$(nproc) && \
    make install && \
    ldconfig

# Install COLMAP
RUN wget https://github.com/colmap/colmap/releases/download/3.8/COLMAP-3.8-linux.tar.gz && \
    tar -xzf COLMAP-3.8-linux.tar.gz && \
    cp -r COLMAP-3.8-linux/* /usr/local/

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
