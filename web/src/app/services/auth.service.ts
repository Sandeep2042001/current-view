import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private authInitialized = new BehaviorSubject<boolean>(false);

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public authInitialized$ = this.authInitialized.asObservable();

  constructor(private http: HttpClient) {
    this.initializeAuthSync();
  }

  private initializeAuthSync(): void {
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      try {
        // Decode JWT token to get user info immediately
        const payload = this.decodeJWTPayload(token);
        if (payload && payload.userId && payload.email) {
          // Create user object from token payload
          const user: User = {
            id: payload.userId,
            email: payload.email,
            firstName: payload.firstName || '',
            lastName: payload.lastName || '',
            role: payload.role || 'user'
          };
          
          // Set user data immediately
          this.currentUserSubject.next(user);
          this.isAuthenticatedSubject.next(true);
          this.authInitialized.next(true);
          
          console.log('Auth restored from token:', user.email, 'Role:', user.role);
          
          // Verify token in background (but don't block UI)
          this.verifyToken(token).subscribe({
            next: (verifiedUser) => {
              if (verifiedUser) {
                this.currentUserSubject.next(verifiedUser);
              } else {
                this.logout();
              }
            },
            error: (error) => {
              console.log('Background token verification failed:', error);
              this.logout();
            }
          });
        } else {
          console.log('Invalid token payload');
          this.logout();
        }
      } catch (error) {
        console.log('Failed to decode token:', error);
        this.logout();
      }
    } else {
      // No token found, ensure we're in logged out state
      this.isAuthenticatedSubject.next(false);
      this.currentUserSubject.next(null);
      this.authInitialized.next(true);
    }
  }

  private decodeJWTPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return null;
    }
  }

  login(email: string, password: string): Observable<{ user: User; token: string }> {
    return this.http.post<{ user: User; token: string }>(`${this.API_URL}/auth/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        localStorage.setItem('auth_token', response.token);
        this.currentUserSubject.next(response.user);
        this.isAuthenticatedSubject.next(true);
        this.authInitialized.next(true);
      })
    );
  }

  register(email: string, password: string, firstName: string, lastName: string): Observable<{ user: User; token: string }> {
    return this.http.post<{ user: User; token: string }>(`${this.API_URL}/auth/register`, {
      email,
      password,
      firstName,
      lastName
    }).pipe(
      tap(response => {
        localStorage.setItem('auth_token', response.token);
        this.currentUserSubject.next(response.user);
        this.isAuthenticatedSubject.next(true);
        this.authInitialized.next(true);
      })
    );
  }

  private verifyToken(token: string): Observable<User | null> {
    return this.http.get<{ user: User }>(`${this.API_URL}/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).pipe(
      map(response => response?.user || null)
    );
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    // Keep authInitialized as true since we've completed the logout process
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}
