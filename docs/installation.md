# Installation Guide

This document describes how to bring the Interactive 360° Platform online in a local environment using the repository tooling. It assumes you have already reviewed the [System Requirements](system-requirements.md) and followed the [Getting Started Guide](getting-started.md).

## 1. Prepare Environment Files

1. Duplicate the environment template:
   ```bash
   cp env.example .env
   ```
2. Update secrets in `.env` with strong values (JWT keys, database password, MinIO credentials).
3. Copy backend-specific variables:
   ```bash
   cd backend
   cp .env.example .env
   ```
4. Align `MINIO_*`, `DATABASE_*`, and `JWT_*` values across root `.env` and `backend/.env`.

## 2. Start Infrastructure Services

Use Docker Compose from the repository root:

```bash
docker compose up -d
```

This spins up:
- PostgreSQL (port 5432)
- MinIO (ports 9000/9001)
- Redis (if configured)

Validate containers:
```bash
docker compose ps
```

## 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### Database Migration & Seed

```bash
npm run migrate   # Applies latest migrations
npm run seed      # Optional sample data
```

### Run Backend

```bash
npm run dev
```

The API listens on `http://localhost:3000`. Confirm with `/health` endpoint.

## 4. Install Web Frontend

```bash
cd web
npm install
npm run start
```

Angular serves at `http://localhost:4200`. During initial development you can log in using seeded credentials or mock authentication if configured.

## 5. Install Mobile Application

```bash
cd mobile
npm install
```

If using Expo-managed workflow, run:
```bash
npx expo start
```

For native builds:
```bash
npx expo prebuild
npx react-native run-android   # or run-ios
```

> **Networking Tip:** Update `API_BASE_URL` in mobile environment files to reference `http://10.0.2.2:3000` for Android emulators or your machine IP for physical devices.

## 6. Computer Vision Pipeline (Optional)

The `cv-pipeline` directory contains workers for processing imagery. To bring them online:

```bash
cd cv-pipeline
npm install
npm run build
npm run start
```

Ensure Redis and MinIO services are active, and configure worker credentials in `cv-pipeline/.env`.

## 7. Verify Integration

- Upload test panoramas via mobile app (mock flow currently) or API scripts
- Confirm MinIO buckets receive imagery
- Check processing jobs in the web admin dashboard (note: retry action is not yet implemented)

## 8. Common Issues

| Issue | Resolution |
| ----- | ---------- |
| `ECONNREFUSED` from web app | Confirm backend is running and CORS settings include the web origin |
| Database migration failure | Verify PostgreSQL container is healthy and credentials match `.env` |
| Mobile bundler cannot reach API | Update `metro.config.js` or `.env` with reachable host IP |
| MinIO access denied | Ensure access keys in `.env` match the container environment |

## 9. Cleanup

To stop all services:
```bash
docker compose down
```

To remove volumes and start fresh:
```bash
docker compose down -v
```

You now have a fully provisioned local environment ready for feature development and testing.
