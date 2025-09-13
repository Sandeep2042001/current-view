# Interactive 360° Platform

A complete cross-platform solution for creating and exploring interactive 360° walkthroughs.

## Architecture

- **Backend**: Node.js/Express with Postgres, MinIO, Auth, and CV workers
- **Mobile App**: React Native (iOS & Android)
- **Web App**: Angular with Three.js/Photo Sphere Viewer
- **Infrastructure**: Docker containerized services

## Quick Start

1. **Prerequisites**
   - Docker & Docker Compose
   - Node.js 18+
   - React Native CLI
   - Angular CLI

2. **Start Backend Services**
   ```bash
   cd backend
   docker-compose up -d
   ```

3. **Start Mobile App**
   ```bash
   cd mobile
   npm install
   npx react-native run-android  # or run-ios
   ```

4. **Start Web App**
   ```bash
   cd web
   npm install
   ng serve
   ```

## Milestones

- [x] Milestone 1: Foundation & Setup
- [x] Milestone 2: Auto-Stitch & 3D Model
        CV pipeline v1 (feature extraction, stitching, auto-linking).
        Export to basic 3D model (mesh reconstruction).
        Quality gates (blur/exposure checks).
        Web viewer v1 (load tours, move between nodes).
        Deliverables: Auto-generated tours with hotspots, stitched 3D model sample, Angular viewer demo.
- [ ] Milestone 3: Measurement Tools & Annotations
        Integrate measurement tools (point-to-point, corner/edge).
        Guided capture UI to ensure overlap.
        Annotation tools (point/polygon, text).
        Admin dashboard (job logs, health checks).
        Deliverables: Functional measurement + annotation tools, admin dashboard, training material draft.  
- [ ] Milestone 4: Hardening, Docs & Handover
        Load & security testing, error handling, backups.
        Full documentation (solution design, operator guide).
        Training session for the client team.
        App Store / Play Store private builds.
        Source code handover + purge of developer copies.
        Deliverables: Production-ready build, documentation package, training completed, signed source code handover.

## Documentation

- [Solution Design Document](docs/solution-design.md)
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
