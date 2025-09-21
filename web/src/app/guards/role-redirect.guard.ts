import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, filter, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleRedirectGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      this.router.navigate(['/login']);
      return of(false);
    }

    // Wait for auth initialization to complete before making decisions
    return this.authService.authInitialized$.pipe(
      filter(initialized => initialized),
      take(1),
      switchMap(() => this.authService.currentUser$),
      take(1),
      map(user => {
        if (!user) {
          this.router.navigate(['/login']);
          return false;
        }

        // Check if user is admin or super_admin
        if (user.role === 'admin' || user.role === 'super_admin') {
          // Redirect admin users to admin dashboard
          this.router.navigate(['/admin']);
          return false;
        } else {
          // Redirect regular users to projects
          this.router.navigate(['/projects']);
          return false;
        }
      })
    );
  }
}
