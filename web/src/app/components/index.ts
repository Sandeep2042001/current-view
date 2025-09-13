// Component barrel exports for cleaner imports
// Usage: import { MeasurementToolsComponent, AnnotationToolsComponent } from './components';

// Admin Components
export { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';

// Annotation Components
export { AnnotationToolsComponent } from './annotation-tools/annotation-tools.component';

// Authentication Components
export { LoginComponent } from './login/login.component';
export { RegisterComponent } from './register/register.component';

// Measurement Components
export { MeasurementToolsComponent } from './measurement-tools/measurement-tools.component';

// Project Components
export { ProjectDetailComponent } from './project-detail/project-detail.component';
export { ProjectsComponent } from './projects/projects.component';

// Viewer Components
export { ViewerComponent } from './viewer/viewer.component';

// Component Groups for Specific Imports
export const AuthComponents = {
  LoginComponent,
  RegisterComponent
} as const;

export const ProjectComponents = {
  ProjectsComponent,
  ProjectDetailComponent
} as const;

export const ToolComponents = {
  MeasurementToolsComponent,
  AnnotationToolsComponent
} as const;

export const ViewerComponents = {
  ViewerComponent
} as const;

export const AdminComponents = {
  AdminDashboardComponent
} as const;

// All components array for dynamic loading
export const ALL_COMPONENTS = [
  AdminDashboardComponent,
  AnnotationToolsComponent,
  LoginComponent,
  RegisterComponent,
  MeasurementToolsComponent,
  ProjectDetailComponent,
  ProjectsComponent,
  ViewerComponent
] as const;

// Component metadata for documentation and tooling
export const COMPONENT_METADATA = {
  AdminDashboardComponent: {
    category: 'Admin',
    description: 'System administration dashboard with health monitoring',
    standalone: true
  },
  AnnotationToolsComponent: {
    category: 'Tools',
    description: 'Interactive annotation tools for 360° spaces',
    standalone: true
  },
  LoginComponent: {
    category: 'Auth',
    description: 'User authentication login form',
    standalone: true
  },
  RegisterComponent: {
    category: 'Auth',
    description: 'User registration form',
    standalone: true
  },
  MeasurementToolsComponent: {
    category: 'Tools',
    description: 'Precision measurement tools for 360° spaces',
    standalone: true
  },
  ProjectDetailComponent: {
    category: 'Projects',
    description: 'Detailed project view and management',
    standalone: true
  },
  ProjectsComponent: {
    category: 'Projects',
    description: 'Project listing and overview',
    standalone: true
  },
  ViewerComponent: {
    category: 'Viewer',
    description: '360° interactive viewer with measurement and annotation support',
    standalone: true
  }
} as const;
