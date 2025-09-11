@echo off
echo 🚀 Starting Interactive 360° Platform...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose and try again.
    pause
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from template...
    copy env.example .env
    echo ⚠️  Please review and update the .env file with your configuration.
)

REM Create logs directory
if not exist logs mkdir logs

REM Start services with Docker Compose
echo 🐳 Starting services with Docker Compose...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check service health
echo 🔍 Checking service health...

REM Check PostgreSQL
docker-compose exec -T postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ PostgreSQL is ready
) else (
    echo ❌ PostgreSQL is not ready
)

REM Check Redis
docker-compose exec -T redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Redis is ready
) else (
    echo ❌ Redis is not ready
)

REM Check MinIO
curl -s http://localhost:9000/minio/health/live >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ MinIO is ready
) else (
    echo ❌ MinIO is not ready
)

REM Check API
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ API server is ready
) else (
    echo ❌ API server is not ready
)

echo.
echo 🎉 Interactive 360° Platform is starting up!
echo.
echo 📱 Mobile App: Run 'cd mobile && npm install && npx react-native run-android' (or run-ios)
echo 🌐 Web App: Run 'cd web && npm install && ng serve'
echo 🔧 Admin Panel: http://localhost:4200/admin
echo 📊 API Health: http://localhost:3000/health
echo 🗄️  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
echo.
echo 📚 Documentation: See docs/solution-design.md
echo.
echo To stop all services: docker-compose down
pause
