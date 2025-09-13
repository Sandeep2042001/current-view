// Service barrel exports for cleaner imports
// Usage: import { AuthService, ProjectService, MeasurementService } from './services';

// Core Services
export { AuthService } from './auth.service';
export { ProjectService } from './project.service';
export { UploadService } from './upload.service';

// Feature Services
export { AnnotationService } from './annotation.service';
export { MeasurementService } from './measurement.service';
export { ProcessingService } from './processing.service';

// Service Groups for Specific Imports
export const CoreServices = {
  AuthService,
  ProjectService,
  UploadService
} as const;

export const ToolServices = {
  AnnotationService,
  MeasurementService
} as const;

export const ProcessingServices = {
  ProcessingService,
  UploadService
} as const;

// All services array for dependency injection
export const ALL_SERVICES = [
  AuthService,
  ProjectService,
  UploadService,
  AnnotationService,
  MeasurementService,
  ProcessingService
] as const;

// Service metadata for documentation and tooling
export const SERVICE_METADATA = {
  AuthService: {
    category: 'Core',
    description: 'User authentication and authorization',
    dependencies: ['HttpClient'],
    singleton: true
  },
  ProjectService: {
    category: 'Core',
    description: 'Project and room management',
    dependencies: ['HttpClient', 'AuthService'],
    singleton: true
  },
  UploadService: {
    category: 'Core',
    description: 'File upload and image management',
    dependencies: ['HttpClient', 'AuthService'],
    singleton: true
  },
  AnnotationService: {
    category: 'Tools',
    description: 'Annotation creation and management',
    dependencies: ['HttpClient', 'AuthService'],
    singleton: true
  },
  MeasurementService: {
    category: 'Tools',
    description: 'Measurement tools and calculations',
    dependencies: ['HttpClient', 'AuthService'],
    singleton: true
  },
  ProcessingService: {
    category: 'Processing',
    description: 'Image processing and job management',
    dependencies: ['HttpClient', 'AuthService'],
    singleton: true
  }
} as const;

// Service provider configuration for easy module setup
export const SERVICE_PROVIDERS = [
  AuthService,
  ProjectService,
  UploadService,
  AnnotationService,
  MeasurementService,
  ProcessingService
];

// Type definitions for service injection
export type CoreServiceType = keyof typeof CoreServices;
export type ToolServiceType = keyof typeof ToolServices;
export type ProcessingServiceType = keyof typeof ProcessingServices;
export type AllServiceType = typeof ALL_SERVICES[number];
