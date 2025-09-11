#!/bin/bash

# Interactive 360° Platform Startup Script

echo "🚀 Starting Interactive 360° Platform..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please review and update the .env file with your configuration."
fi

# Create logs directory
mkdir -p logs

# Start services with Docker Compose
echo "🐳 Starting services with Docker Compose..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

# Check MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo "✅ MinIO is ready"
else
    echo "❌ MinIO is not ready"
fi

# Check API
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API server is ready"
else
    echo "❌ API server is not ready"
fi

echo ""
echo "🎉 Interactive 360° Platform is starting up!"
echo ""
echo "📱 Mobile App: Run 'cd mobile && npm install && npx react-native run-android' (or run-ios)"
echo "🌐 Web App: Run 'cd web && npm install && ng serve'"
echo "🔧 Admin Panel: http://localhost:4200/admin"
echo "📊 API Health: http://localhost:3000/health"
echo "🗄️  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "📚 Documentation: See docs/solution-design.md"
echo ""
echo "To stop all services: docker-compose down"
