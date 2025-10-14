import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { RoleRedirectGuard } from './guards/role-redirect.guard';

export const AppRoutes: Routes = [
  { 
    path: '', 
    canActivate: [RoleRedirectGuard],
    children: []
  },
  { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent) },
  { 
    path: 'projects', 
    loadComponent: () => import('./components/projects/projects.component').then(m => m.ProjectsComponent),
    canActivate: [AuthGuard]
  },
  { 
    path: 'projects/:id', 
    loadComponent: () => import('./components/project-detail/project-detail.component').then(m => m.ProjectDetailComponent),
    canActivate: [AuthGuard]
  },
  { 
    path: 'viewer/:projectId/:roomId', 
    loadComponent: () => import('./components/viewer/viewer.component').then(m => m.ViewerComponent),
    canActivate: [AuthGuard]
  },
  { 
    path: 'admin', 
    loadComponent: () => import('./components/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [AdminGuard]
  },
  { path: '**', redirectTo: '/projects' }
];
