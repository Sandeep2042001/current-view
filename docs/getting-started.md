# Getting Started Guide

## Overview

This guide walks new team members through the fastest way to explore the Interactive 360° Platform in a local development environment. It focuses on spinning up the core backend services, running the Angular web application, and previewing the React Native mobile client with mock data.

> **Tip:** If you prefer scripted setup, review the repository-level `README.md` for quick commands that mirror the steps below.

## 1. Clone the Repository

1. Ensure you have access to the Git repository
2. Clone it to your workstation:
   ```bash
   git clone <your-fork-url> current-view
   cd current-view
   ```

## 2. Install Prerequisites

| Tool | Version | Purpose |
| ---- | ------- | ------- |
| Node.js | 18.x LTS | Backend scripts, Angular CLI, React Native tooling |
| npm | 9+ | Package manager for Node projects |
| Docker & Docker Compose | Latest stable | Local Postgres, MinIO, and supporting services |
| Java JDK | 11+ | Required by Android toolchain |
| Android Studio / Xcode | Latest stable | Building and running the mobile client |
| Watchman (macOS) | Optional | Improves React Native rebuild performance |

Install platform-specific dependencies (Android SDK, iOS tooling) using official platform instructions.

## 3. Configure Environment Variables

1. Copy the provided example environment file:
   ```bash
   cp env.example .env
   ```
2. Update secrets such as database passwords, S3/MinIO credentials, and JWT keys to match your local environment.
3. For mobile development, ensure identical values exist in `mobile/.env` (create one if it does not exist) so that the app can reach your backend.

## 4. Start Backend Infrastructure

From the repository root:

```bash
cd backend
cp .env.example .env        # Adjust credentials as needed
npm install
npm run migrate             # Applies database migrations
npm run seed                # (Optional) Loads sample data
npm run dev                 # Starts the Express API
```

Supporting services such as Postgres and MinIO can be launched via Docker:

```bash
docker compose up -d        # Uses docker-compose.yml in repo root
```

Verify health by opening `http://localhost:3000/health`.

## 5. Launch the Web Application

```bash
cd web
npm install
npm run start
```

The Angular development server runs at `http://localhost:4200`. Use the mock login or credentials from your seeded database.

## 6. Launch the Mobile Application

1. Install dependencies and build assets:
   ```bash
   cd mobile
   npm install
   npx expo prebuild         # Generates native projects (if needed)
   ```
2. Run on a device/emulator:
   ```bash
   npx react-native run-android
   # or
   npx react-native run-ios
   ```
3. Ensure your emulator/device can reach `http://localhost:3000`. On Android emulators use `http://10.0.2.2:3000`.

## 7. Explore Mock Workflows

While several API integrations remain TODOs, you can still validate UI flows:

- Create and view projects/rooms using mock data on mobile
- Navigate between scenes in the web viewer
- Review admin dashboard job listings populated with stubbed responses

## 8. Next Steps

- Connect API clients to the live backend once endpoints are finalized
- Replace mock services with real implementations as you progress through milestones
- Review the [Measurement Tools User Guide](user-guide-measurement-tools.md) and [Annotation Tools User Guide](user-guide-annotation-tools.md) for feature-specific training

## Troubleshooting

- **Docker containers failing to start:** Run `docker compose logs` for detailed errors, often tied to port collisions or missing environment variables.
- **React Native build errors:** Clean caches with `npx react-native-clean-project` or re-run `npx expo prebuild` after dependency updates.
- **Web app CORS issues:** Ensure the backend `CORS_ORIGIN` allows `http://localhost:4200` during development.

You're ready to begin contributing! Continue with the [System Requirements](system-requirements.md) and [Installation Guide](installation.md) for deeper configuration details.
