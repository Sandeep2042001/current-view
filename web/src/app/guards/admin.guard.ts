import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
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

    // Check if we have user data immediately available
    const currentUser = this.authService.getCurrentUser();
    
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
      return of(true);
    }

    // If no user data yet, wait for it to load
    return this.authService.currentUser$.pipe(
      filter(user => user !== null),
      take(1),
      map(user => {
        if (user && (user.role === 'admin' || user.role === 'super_admin')) {
          return true;
        } else {
          this.router.navigate(['/login']);
          return false;
        }
      })
    );
  }
}
