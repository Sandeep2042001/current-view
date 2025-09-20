import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
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
    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          // Not authenticated, redirect to login
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
