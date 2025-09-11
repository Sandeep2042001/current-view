# Interactive 360° Platform - Solution Design Document

## 1. Executive Summary

The Interactive 360° Platform is a comprehensive cross-platform solution for creating, processing, and exploring interactive 360° walkthroughs. The system enables users to capture 360° images, automatically stitch them into seamless panoramas, generate 3D models, and create interactive experiences with hotspots, annotations, and measurements.

## 2. Architecture Overview

### 2.1 System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web App       │    │   Admin Panel   │
│   (React Native)│    │   (Angular)     │    │   (Angular)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Express.js)  │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Auth Service  │    │  Project Mgmt   │    │  Upload Service │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   CV Pipeline   │
                    │   (Python/Node) │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │     MinIO       │    │     Redis       │
│   (Database)    │    │  (Object Store) │    │   (Cache/Queue) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2.2 Technology Stack

#### Backend Services
- **API Server**: Node.js with Express.js
- **Database**: PostgreSQL 15
- **Object Storage**: MinIO
- **Cache/Queue**: Redis
- **Authentication**: JWT-based
- **File Processing**: Sharp, OpenCV
- **3D Reconstruction**: COLMAP, OpenMVG

#### Mobile Application
- **Framework**: React Native
- **Platforms**: iOS & Android
- **Camera**: React Native Camera
- **Sensors**: Gyroscope, Compass
- **Storage**: AsyncStorage, Keychain

#### Web Application
- **Framework**: Angular 17
- **3D Viewer**: Three.js, Photo Sphere Viewer
- **UI Components**: Angular Material
- **State Management**: RxJS

#### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx
- **Monitoring**: Winston Logging
- **CI/CD**: GitHub Actions (planned)

## 3. Core Features

### 3.1 Mobile App Features

#### Project Management
- User authentication and authorization
- Project creation and management
- Room organization within projects
- Offline project synchronization

#### 360° Image Capture
- Native camera integration
- Gyroscope and compass data capture
- Metadata collection (EXIF, sensor data)
- Image quality validation
- Offline queue with resumable uploads

#### Import Capabilities
- Wi-Fi import from consumer 360 cameras
- File system import
- Batch processing support

### 3.2 Web Application Features

#### 360° Viewer
- Three.js-based panoramic viewer
- Smooth navigation controls
- Mouse and gyroscope support
- Hotspot interaction system
- Minimap/floorplan integration

#### Annotation Tools
- Point annotations with text
- Polygon annotations
- Line annotations
- Custom styling options

#### Measurement Tools
- Point-to-point measurements
- Corner/edge measurements
- Attribute-based measurements
- Real-time distance calculation

#### Project Management
- Project dashboard
- Room management
- Image gallery
- Processing status monitoring

### 3.3 Backend Services

#### API Services
- RESTful API design
- JWT authentication
- Role-based access control
- Rate limiting and security

#### Computer Vision Pipeline
- Feature extraction and matching
- Image stitching algorithms
- SLAM-based hotspot graph generation
- Auto-floor grouping
- 3D mesh reconstruction

#### Data Management
- PostgreSQL for structured data
- MinIO for object storage
- Redis for caching and job queues
- Automated backup strategies

## 4. Data Models

### 4.1 Core Entities

#### User
```sql
- id: UUID (Primary Key)
- email: VARCHAR (Unique)
- password_hash: VARCHAR
- first_name: VARCHAR
- last_name: VARCHAR
- role: ENUM (user, admin, super_admin)
- is_active: BOOLEAN
- last_login: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Project
```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key)
- name: VARCHAR
- description: TEXT
- status: ENUM (draft, processing, completed, failed)
- settings: JSON
- metadata: JSON
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Room
```sql
- id: UUID (Primary Key)
- project_id: UUID (Foreign Key)
- name: VARCHAR
- description: TEXT
- position: JSON (3D coordinates)
- rotation: JSON (3D rotation)
- status: ENUM (pending, processing, completed, failed)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Image
```sql
- id: UUID (Primary Key)
- room_id: UUID (Foreign Key)
- filename: VARCHAR
- original_filename: VARCHAR
- mime_type: VARCHAR
- file_size: BIGINT
- storage_path: VARCHAR
- metadata: JSON (EXIF, gyro, compass)
- processing_status: JSON
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Hotspot
```sql
- id: UUID (Primary Key)
- room_id: UUID (Foreign Key)
- target_room_id: UUID (Foreign Key, nullable)
- type: ENUM (navigation, info, measurement)
- position: JSON (3D coordinates)
- rotation: JSON (3D rotation)
- title: VARCHAR
- description: TEXT
- data: JSON (additional data)
- is_auto_generated: BOOLEAN
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 4.2 Processing Jobs

#### Processing Job
```sql
- id: UUID (Primary Key)
- project_id: UUID (Foreign Key)
- type: ENUM (stitching, 3d_reconstruction, hotspot_generation)
- status: ENUM (pending, processing, completed, failed)
- input_data: JSON
- output_data: JSON
- error_message: TEXT
- started_at: TIMESTAMP
- completed_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## 5. API Design

### 5.1 Authentication Endpoints

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/verify
```

### 5.2 Project Management

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/rooms
```

### 5.3 Upload & Processing

```
POST /api/upload/image/:roomId
GET  /api/upload/image/:imageId
DELETE /api/upload/image/:imageId
GET  /api/upload/progress/:roomId
POST /api/processing/stitch/:roomId
POST /api/processing/reconstruct/:projectId
POST /api/processing/hotspots/:roomId
GET  /api/processing/job/:jobId
```

### 5.4 Admin Endpoints

```
GET  /api/admin/stats
GET  /api/admin/users
GET  /api/admin/projects
GET  /api/admin/jobs
GET  /api/admin/health
GET  /api/admin/queue
POST /api/admin/jobs/clear-failed
```

## 6. Security Considerations

### 6.1 Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Secure password hashing (bcrypt)
- Token expiration and refresh

### 6.2 Data Protection
- HTTPS/TLS encryption
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

### 6.3 File Security
- Secure file upload validation
- Virus scanning (planned)
- Access control for stored files
- Presigned URLs for secure access

## 7. Performance Considerations

### 7.1 Backend Optimization
- Database indexing strategy
- Connection pooling
- Redis caching
- Image processing optimization
- Async job processing

### 7.2 Frontend Optimization
- Lazy loading
- Image compression
- CDN integration (planned)
- Progressive Web App features
- Offline support

### 7.3 Mobile Optimization
- Image compression and resizing
- Offline queue management
- Background processing
- Battery optimization

## 8. Error Handling & Logging

### 8.1 Error Handling Strategy
- Centralized error handling middleware
- Structured error responses
- Client-side error boundaries
- Graceful degradation

### 8.2 Logging Framework
- Winston-based structured logging
- Log levels (error, warn, info, debug)
- File rotation and retention
- Centralized log aggregation (planned)

### 8.3 Monitoring & Alerting
- Health check endpoints
- Performance metrics
- Error rate monitoring
- Alert notifications (planned)

## 9. Deployment Architecture

### 9.1 Development Environment
- Docker Compose for local development
- Hot reloading for all services
- Shared development database
- Mock services for testing

### 9.2 Production Environment
- Containerized services
- Load balancer (Nginx)
- Database clustering (planned)
- Auto-scaling (planned)
- Blue-green deployments (planned)

### 9.3 CI/CD Pipeline
- Automated testing
- Code quality checks
- Security scanning
- Automated deployments
- Rollback capabilities

## 10. Scalability Considerations

### 10.1 Horizontal Scaling
- Stateless API design
- Database read replicas
- CDN integration
- Microservices architecture (future)

### 10.2 Vertical Scaling
- Resource monitoring
- Performance profiling
- Database optimization
- Caching strategies

## 11. Future Enhancements

### 11.1 Advanced Features
- AI-powered hotspot detection
- Voice annotations
- Collaborative editing
- Real-time collaboration
- Advanced analytics

### 11.2 Platform Extensions
- VR/AR support
- Mobile SDK
- Third-party integrations
- API marketplace

## 12. Risk Assessment

### 12.1 Technical Risks
- Image processing performance
- 3D reconstruction accuracy
- Mobile platform compatibility
- Browser compatibility

### 12.2 Mitigation Strategies
- Performance testing
- Quality assurance processes
- Cross-platform testing
- Progressive enhancement

## 13. Success Metrics

### 13.1 Performance Metrics
- Image processing time
- 3D reconstruction quality
- User engagement
- System uptime

### 13.2 Business Metrics
- User adoption rate
- Feature usage
- Customer satisfaction
- Revenue metrics (if applicable)

---

*This document serves as the technical foundation for the Interactive 360° Platform development and will be updated as the project evolves.*
