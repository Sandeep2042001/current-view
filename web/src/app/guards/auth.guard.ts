import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
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

    // If token exists, allow access immediately
    // Auth service will handle verification in background
    return of(true);
  }
}
