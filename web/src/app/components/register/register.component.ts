import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <div class="register-header">
          <h1 class="register-title">Create Account</h1>
          <p class="register-subtitle">Join Interactive 360° Platform</p>
        </div>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="register-form">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                formControlName="firstName"
                class="form-input"
                placeholder="Enter your first name"
              />
              <div *ngIf="registerForm.get('firstName')?.invalid && registerForm.get('firstName')?.touched" class="error-message">
                First name is required
              </div>
            </div>

            <div class="form-group">
              <label for="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                formControlName="lastName"
                class="form-input"
                placeholder="Enter your last name"
              />
              <div *ngIf="registerForm.get('lastName')?.invalid && registerForm.get('lastName')?.touched" class="error-message">
                Last name is required
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              formControlName="email"
              class="form-input"
              placeholder="Enter your email"
            />
            <div *ngIf="registerForm.get('email')?.invalid && registerForm.get('email')?.touched" class="error-message">
              Please enter a valid email
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              formControlName="password"
              class="form-input"
              placeholder="Enter your password"
            />
            <div *ngIf="registerForm.get('password')?.invalid && registerForm.get('password')?.touched" class="error-message">
              Password must be at least 8 characters long
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              formControlName="confirmPassword"
              class="form-input"
              placeholder="Confirm your password"
            />
            <div *ngIf="registerForm.get('confirmPassword')?.invalid && registerForm.get('confirmPassword')?.touched" class="error-message">
              Passwords do not match
            </div>
          </div>

          <button
            type="submit"
            [disabled]="registerForm.invalid || loading"
            class="register-button"
          >
            {{ loading ? 'Creating Account...' : 'Create Account' }}
          </button>

          <div class="register-footer">
            <p>Already have an account? <a routerLink="/login" class="link">Sign in</a></p>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.loading = true;
      const { firstName, lastName, email, password } = this.registerForm.value;

      this.authService.register(email, password, firstName, lastName).subscribe({
        next: (response) => {
          this.toastr.success('Account created successfully!');
          
          // Redirect based on user role (though new users will be 'user' by default)
          if (response.user.role === 'admin' || response.user.role === 'super_admin') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/projects']);
          }
        },
        error: (error) => {
          this.toastr.error(error.error?.error || 'Registration failed');
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    }
  }
}
