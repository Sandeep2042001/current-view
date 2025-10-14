# System Requirements

Understanding the minimum and recommended requirements helps prevent configuration surprises during development, demos, and testing.

## Operating Systems

| Role | Supported Versions | Notes |
| ---- | ------------------ | ----- |
| Backend host | macOS 13+, Windows 11, Ubuntu 22.04 LTS | Must support Docker Desktop or native Docker engine |
| Web app development | macOS 13+, Windows 11, Ubuntu 22.04 LTS | Needs Node.js 18.x and Angular CLI |
| Mobile development | macOS 13+ (for iOS), Windows 11 or macOS 13+ (for Android) | Xcode required for iOS builds; Android Studio for Android |

## Hardware

- **CPU:** Quad-core 2.6 GHz or higher recommended for running Docker, Angular, and React Native simultaneously
- **Memory:** Minimum 16 GB RAM (Docker + Android emulator often exceeds 12 GB); 32 GB recommended
- **Storage:** 50 GB free disk space for containers, dependencies, and build artifacts
- **GPU:** Optional but recommended for smoother Android emulator usage

## Software Dependencies

| Component | Version | Purpose |
| --------- | ------- | ------- |
| Node.js | 18.x LTS | Required for backend scripts, Angular CLI, and React Native tools |
| npm | 9+ | Package manager used across backend, web, and mobile workspaces |
| Docker Desktop / Engine | Latest stable | Provides Postgres, MinIO, and auxiliary services |
| docker compose plugin | v2+ | Used by repository-level Compose files |
| Git | 2.40+ | Source control and hooks |
| Angular CLI | 16+ | Builds and serves the web frontend |
| React Native CLI | Latest stable | Builds and runs the mobile app |
| Watchman (macOS) | Optional | Improves rebuild times for React Native |

### Mobile Tooling

- **Android:** Android Studio Flamingo+ with SDK 33, Android SDK Platform-Tools, and an emulator image (Pixel 6, API 33 recommended)
- **iOS:** Xcode 15+, iOS 17 SDK, and a simulator image (iPhone 15 recommended)

## Network & Ports

The platform uses several local ports. Ensure they are free or adjust `.env` files accordingly.

| Service | Port | Notes |
| ------- | ---- | ----- |
| Backend API | 3000 | Express server (REST endpoints) |
| Web App | 4200 | Angular dev server |
| PostgreSQL | 5432 | Managed via Docker Compose |
| MinIO API | 9000 | S3-compatible object storage |
| MinIO Console | 9001 | Web UI for managing buckets |
| Redis / Worker queues | 6379 | Optional; only when running CV pipeline workers |

## Permissions & Security

- Ensure Docker Desktop has access to the directories containing project data
- On macOS, grant Full Disk Access to Docker if storing large imagery sets
- Configure `.env` secrets with unique values before exposing endpoints beyond localhost

## Recommended Browser Support

- Google Chrome 118+
- Microsoft Edge 118+
- Safari 17+
- Firefox 118+

## Sample Data Considerations

High-resolution panoramic images consume significant disk and network bandwidth. When testing locally:

- Resize imagery to <25 MB per panorama to reduce upload times
- Use the provided `export-local-data.sh` to generate anonymized samples
- Store large assets outside the Git repository to avoid accidental commits

## Next Steps

After verifying your environment meets these requirements, proceed with the [Installation Guide](installation.md) to bring services online, then follow the [Getting Started Guide](getting-started.md) for hands-on workflows.
