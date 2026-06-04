import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">

        <!-- Logo Yoolo centré -->
        <div class="auth-logo">
          <img src="yoolo-logo.jpg" class="logo-img" alt="Yoolo" />
        </div>

        <h2>{{ 'AUTH.LOGIN.TITLE' | translate }}</h2>
        <p class="auth-subtitle">{{ 'AUTH.LOGIN.SUBTITLE' | translate }}</p>

        <div class="alert alert-error" *ngIf="error">{{ error | translate }}</div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-group">
            <label>{{ 'AUTH.LOGIN.PHONE' | translate }}</label>
            <input
              type="tel"
              formControlName="phone_number"
              [placeholder]="'AUTH.LOGIN.PHONE_PLACEHOLDER' | translate"
              [class.invalid]="submitted && f['phone_number'].errors"
            />
            <span class="field-error" *ngIf="submitted && f['phone_number'].errors?.['required']">
              {{ 'COMMON.REQUIRED' | translate }}
            </span>
          </div>

          <div class="form-group">
            <label>{{ 'AUTH.LOGIN.PASSWORD' | translate }}</label>
            <div class="password-wrap">
              <input
                [type]="showPwd ? 'text' : 'password'"
                formControlName="password"
                [placeholder]="'AUTH.LOGIN.PASSWORD_PLACEHOLDER' | translate"
                [class.invalid]="submitted && f['password'].errors"
              />
              <button type="button" class="pwd-toggle" (click)="showPwd = !showPwd">
                {{ showPwd ? '🙈' : '👁️' }}
              </button>
            </div>
            <span class="field-error" *ngIf="submitted && f['password'].errors?.['required']">
              {{ 'COMMON.REQUIRED' | translate }}
            </span>
          </div>

          <button type="submit" class="btn-gold" [disabled]="loading">
            {{ (loading ? 'AUTH.LOGIN.SUBMITTING' : 'AUTH.LOGIN.SUBMIT') | translate }}
          </button>
        </form>

        <div class="auth-links">
          <span>{{ 'AUTH.LOGIN.NO_ACCOUNT' | translate }}</span>
          <a routerLink="/auth/register">{{ 'AUTH.LOGIN.REGISTER_LINK' | translate }}</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(160deg, #111111 0%, #1a1a1a 60%, #0d0d0d 100%);
      padding: 24px;
    }

    .auth-card {
      background: #ffffff;
      border-radius: 24px;
      padding: 40px 44px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,162,39,0.15);
    }

    /* Logo */
    .auth-logo {
      display: flex;
      justify-content: center;
      margin-bottom: 28px;
    }
    .logo-img {
      width: 160px;
      height: 160px;
      object-fit: contain;
      border-radius: 16px;
    }

    /* Titles */
    h2 {
      font-size: 22px; font-weight: 800;
      color: #1A1A1A; margin-bottom: 6px; text-align: center;
    }
    .auth-subtitle {
      color: #757575; margin-bottom: 28px;
      font-size: 14px; text-align: center;
    }

    /* Form */
    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
    input {
      width: 100%; padding: 13px 16px;
      border: 1.5px solid #E5E2DA; border-radius: 12px;
      font-size: 14px; outline: none; transition: border-color .2s, box-shadow .2s;
      background: #FAFAF8; color: #1A1A1A;
    }
    input:focus {
      border-color: #C9A227;
      box-shadow: 0 0 0 3px rgba(201,162,39,0.12);
      background: white;
    }
    input.invalid { border-color: #E53935; }
    .field-error { font-size: 11px; color: #E53935; margin-top: 4px; display: block; }
    .password-wrap { position: relative; }
    .pwd-toggle {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; font-size: 16px; padding: 0;
    }

    /* Button */
    .btn-gold {
      width: 100%; padding: 14px;
      background: linear-gradient(135deg, #C9A227 0%, #A8861F 100%);
      color: #1A1A1A; border: none; border-radius: 12px;
      font-size: 15px; font-weight: 800; letter-spacing: 0.3px;
      cursor: pointer; margin-top: 8px; transition: all .2s;
      box-shadow: 0 4px 16px rgba(201,162,39,0.4);
    }
    .btn-gold:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(201,162,39,0.5);
    }
    .btn-gold:active:not(:disabled) { transform: translateY(0); }
    .btn-gold:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Alert */
    .alert-error {
      background: #FFEBEE; color: #C62828; border-radius: 10px;
      padding: 12px 14px; margin-bottom: 16px; font-size: 13px;
    }

    /* Links */
    .auth-links {
      text-align: center; margin-top: 22px; font-size: 13px;
      color: #757575; display: flex; gap: 6px;
      justify-content: center; align-items: center;
    }
    .auth-links a { color: #C9A227; font-weight: 700; text-decoration: none; }
    .auth-links a:hover { text-decoration: underline; }

    @media (max-width: 480px) {
      .auth-card { padding: 28px 20px; }
      .logo-img { width: 130px; height: 130px; }
    }
  `]
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  showPwd = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      phone_number: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  get f() { return this.form.controls; }

  submit(): void {
    this.submitted = true;
    this.error = '';
    if (this.form.invalid) return;
    this.loading = true;
    this.auth.login(this.f['phone_number'].value, this.f['password'].value).subscribe({
      next: () => { sessionStorage.setItem('showSidebarOnLoad', 'true'); this.router.navigate(['/dashboard']); },
      error: (err: any) => {
        this.error = err?.error?.error?.message || err?.error?.detail || 'AUTH.LOGIN.ERROR_INVALID';
        this.loading = false;
      },
    });
  }
}
