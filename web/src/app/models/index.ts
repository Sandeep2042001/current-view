// Model barrel exports for cleaner imports
// Usage: import { User, Project, Room, Measurement, Annotation } from './models';

// Re-export all types and interfaces from user.model.ts
export type {
  User,
  Project,
  Room,
  Image,
  Hotspot,
  Annotation,
  Measurement
} from './user.model';

// Type utilities and guards
export const isUser = (obj: any): obj is User => {
  return obj && typeof obj.id === 'string' && typeof obj.email === 'string';
};

export const isProject = (obj: any): obj is Project => {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
};

export const isRoom = (obj: any): obj is Room => {
  return obj && typeof obj.id === 'string' && typeof obj.projectId === 'string';
};

export const isAnnotation = (obj: any): obj is Annotation => {
  return obj && typeof obj.id === 'string' && typeof obj.roomId === 'string' && obj.type;
};

export const isMeasurement = (obj: any): obj is Measurement => {
  return obj && typeof obj.id === 'string' && typeof obj.roomId === 'string' && obj.points;
};

// Enums and constants
export const USER_ROLES = ['user', 'admin', 'super_admin'] as const;
export const PROJECT_STATUSES = ['draft', 'processing', 'completed', 'failed'] as const;
export const ROOM_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export const HOTSPOT_TYPES = ['navigation', 'info', 'measurement'] as const;
export const ANNOTATION_TYPES = ['point', 'polygon', 'line'] as const;
export const MEASUREMENT_TYPES = ['point_to_point', 'corner', 'edge'] as const;
export const MEASUREMENT_UNITS = ['meters', 'feet', 'inches', 'centimeters', 'millimeters'] as const;

// Type unions for better type safety
export type UserRole = typeof USER_ROLES[number];
export type ProjectStatus = typeof PROJECT_STATUSES[number];
export type RoomStatus = typeof ROOM_STATUSES[number];
export type HotspotType = typeof HOTSPOT_TYPES[number];
export type AnnotationType = typeof ANNOTATION_TYPES[number];
export type MeasurementType = typeof MEASUREMENT_TYPES[number];
export type MeasurementUnit = typeof MEASUREMENT_UNITS[number];

// Utility types for API responses
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
}

// Form data types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface ProjectForm {
  name: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface RoomForm {
  name: string;
  description?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface MeasurementForm {
  type: MeasurementType;
  points: Array<{
    x: number;
    y: number;
    z: number;
  }>;
  unit: MeasurementUnit;
  label?: string;
}

export interface AnnotationForm {
  type: AnnotationType;
  coordinates: Array<{
    x: number;
    y: number;
    z: number;
  }>;
  title?: string;
  description?: string;
  style?: {
    color?: string;
    size?: number;
    opacity?: number;
    showLabels?: boolean;
  };
}

// Extended types with computed properties
export interface ProjectWithStats extends Project {
  stats?: {
    totalRooms: number;
    completedRooms: number;
    totalImages: number;
    totalMeasurements: number;
    totalAnnotations: number;
  };
}

export interface RoomWithAssets extends Room {
  measurementCount?: number;
  annotationCount?: number;
  imageCount?: number;
  processingProgress?: number;
}

export interface AnnotationWithMetadata extends Annotation {
  screenPosition?: { x: number; y: number };
  area?: number; // For polygons
  length?: number; // For lines
}

export interface MeasurementWithMetadata extends Measurement {
  screenPosition?: { x: number; y: number };
  angle?: number; // For corner measurements
}

// Upload and processing types
export interface UploadProgress {
  roomId: string;
  totalImages: number;
  uploadedImages: number;
  processedImages: number;
  stitchedImages: number;
  progress: number;
}

export interface ProcessingJob {
  id: string;
  projectId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// System and admin types
export interface SystemHealth {
  database: 'healthy' | 'unhealthy';
  redis: 'healthy' | 'unhealthy';
  minio: 'healthy' | 'unhealthy';
  overall: 'healthy' | 'unhealthy';
  timestamp: string;
}

export interface SystemStats {
  totalUsers: number;
  totalProjects: number;
  totalRooms: number;
  totalImages: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
}

// Export everything as a namespace as well for organized imports
export * as Models from './user.model';
export * as Types from './user.model';

// Default export for convenience
export { User as DefaultUser } from './user.model';
