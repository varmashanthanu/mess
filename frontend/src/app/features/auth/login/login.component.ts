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

        <div class="auth-logo">
          <img src="yoolo-logo.jpg" class="logo-img" alt="Yoolo" />
        </div>

        <!-- Mode tabs -->
        <div class="login-tabs">
          <button
            class="tab-btn"
            [class.active]="mode === 'standard'"
            (click)="setMode('standard')"
          >{{ 'AUTH.LOGIN.TAB_STANDARD' | translate }}</button>
          <button
            class="tab-btn"
            [class.active]="mode === 'company'"
            (click)="setMode('company')"
          >{{ 'AUTH.LOGIN.TAB_COMPANY_DRIVER' | translate }}</button>
        </div>

        <div class="alert alert-error" *ngIf="error">{{ error }}</div>

        <!-- Standard login -->
        <form *ngIf="mode === 'standard'" [formGroup]="standardForm" (ngSubmit)="submitStandard()">
          <h2>{{ 'AUTH.LOGIN.TITLE' | translate }}</h2>
          <p class="auth-subtitle">{{ 'AUTH.LOGIN.SUBTITLE' | translate }}</p>

          <div class="form-group">
            <label>{{ 'AUTH.LOGIN.PHONE' | translate }}</label>
            <input
              type="tel"
              formControlName="phone_number"
              [placeholder]="'AUTH.LOGIN.PHONE_PLACEHOLDER' | translate"
              [class.invalid]="submittedStd && sf['phone_number'].errors"
            />
          </div>

          <div class="form-group">
            <label>{{ 'AUTH.LOGIN.PASSWORD' | translate }}</label>
            <div class="password-wrap">
              <input
                [type]="showPwd ? 'text' : 'password'"
                formControlName="password"
                [placeholder]="'AUTH.LOGIN.PASSWORD_PLACEHOLDER' | translate"
                [class.invalid]="submittedStd && sf['password'].errors"
              />
              <button type="button" class="pwd-toggle" (click)="showPwd = !showPwd">
                {{ showPwd ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <button type="submit" class="btn-gold" [disabled]="loading">
            {{ (loading ? 'AUTH.LOGIN.SUBMITTING' : 'AUTH.LOGIN.SUBMIT') | translate }}
          </button>
        </form>

        <!-- Company driver login -->
        <form *ngIf="mode === 'company'" [formGroup]="companyForm" (ngSubmit)="submitCompany()">
          <h2>{{ 'AUTH.LOGIN.COMPANY_DRIVER_TITLE' | translate }}</h2>
          <p class="auth-subtitle">{{ 'AUTH.LOGIN.COMPANY_DRIVER_SUBTITLE' | translate }}</p>

          <div class="form-group">
            <label>{{ 'AUTH.LOGIN.PHONE' | translate }}</label>
            <input
              type="tel"
              formControlName="phone_number"
              [placeholder]="'AUTH.LOGIN.PHONE_PLACEHOLDER' | translate"
              [class.invalid]="submittedCo && cf['phone_number'].errors"
            />
          </div>

          <div class="form-group">
            <label>{{ 'AUTH.LOGIN.COMPANY_CODE' | translate }}</label>
            <input
              type="text"
              formControlName="company_code"
              [placeholder]="'AUTH.LOGIN.COMPANY_CODE_PLACEHOLDER' | translate"
              style="text-transform: uppercase; letter-spacing: 2px;"
              [class.invalid]="submittedCo && cf['company_code'].errors"
            />
            <span class="field-hint">{{ 'AUTH.LOGIN.COMPANY_CODE_HINT' | translate }}</span>
          </div>

          <button type="submit" class="btn-gold" [disabled]="loading">
            {{ (loading ? 'AUTH.LOGIN.SUBMITTING' : 'AUTH.LOGIN.SUBMIT') | translate }}
          </button>
        </form>

        <div class="auth-links" *ngIf="mode === 'standard'">
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

    .auth-logo {
      display: flex;
      justify-content: center;
      margin-bottom: 20px;
    }
    .logo-img {
      width: 140px;
      height: 140px;
      object-fit: contain;
      border-radius: 16px;
    }

    .login-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      background: #F5F5F3;
      border-radius: 14px;
      padding: 4px;
    }
    .tab-btn {
      flex: 1;
      padding: 10px 8px;
      border: none;
      border-radius: 10px;
      background: transparent;
      font-size: 13px;
      font-weight: 600;
      color: #757575;
      cursor: pointer;
      transition: all .2s;
    }
    .tab-btn.active {
      background: #fff;
      color: #1A1A1A;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    h2 {
      font-size: 20px; font-weight: 800;
      color: #1A1A1A; margin-bottom: 6px; text-align: center;
    }
    .auth-subtitle {
      color: #757575; margin-bottom: 24px;
      font-size: 13px; text-align: center;
    }

    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
    input {
      width: 100%; padding: 13px 16px;
      border: 1.5px solid #E5E2DA; border-radius: 12px;
      font-size: 14px; outline: none; transition: border-color .2s, box-shadow .2s;
      background: #FAFAF8; color: #1A1A1A;
      box-sizing: border-box;
    }
    input:focus {
      border-color: #C9A227;
      box-shadow: 0 0 0 3px rgba(201,162,39,0.12);
      background: white;
    }
    input.invalid { border-color: #E53935; }
    .field-hint { font-size: 11px; color: #9E9E9E; margin-top: 4px; display: block; }
    .password-wrap { position: relative; }
    .pwd-toggle {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; font-size: 16px; padding: 0;
    }

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

    .alert-error {
      background: #FFEBEE; color: #C62828; border-radius: 10px;
      padding: 12px 14px; margin-bottom: 16px; font-size: 13px;
    }

    .auth-links {
      text-align: center; margin-top: 22px; font-size: 13px;
      color: #757575; display: flex; gap: 6px;
      justify-content: center; align-items: center;
    }
    .auth-links a { color: #C9A227; font-weight: 700; text-decoration: none; }
    .auth-links a:hover { text-decoration: underline; }

    @media (max-width: 480px) {
      .auth-card { padding: 28px 20px; }
      .logo-img { width: 110px; height: 110px; }
    }
  `]
})
export class LoginComponent {
  mode: 'standard' | 'company' = 'standard';

  standardForm: FormGroup;
  companyForm: FormGroup;

  loading = false;
  submittedStd = false;
  submittedCo = false;
  error = '';
  showPwd = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.standardForm = this.fb.group({
      phone_number: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
    this.companyForm = this.fb.group({
      phone_number: ['', [Validators.required]],
      company_code: ['', [Validators.required]],
    });
  }

  get sf() { return this.standardForm.controls; }
  get cf() { return this.companyForm.controls; }

  setMode(m: 'standard' | 'company'): void {
    this.mode = m;
    this.error = '';
    this.submittedStd = false;
    this.submittedCo = false;
  }

  submitStandard(): void {
    this.submittedStd = true;
    this.error = '';
    if (this.standardForm.invalid) return;
    this.loading = true;
    this.auth.login(this.sf['phone_number'].value, this.sf['password'].value).subscribe({
      next: () => { sessionStorage.setItem('showSidebarOnLoad', 'true'); this.router.navigate(['/dashboard']); },
      error: (err: any) => {
        this.error = err?.error?.error?.message || err?.error?.detail || 'Identifiants incorrects.';
        this.loading = false;
      },
    });
  }

  submitCompany(): void {
    this.submittedCo = true;
    this.error = '';
    if (this.companyForm.invalid) return;
    this.loading = true;
    this.auth.companyDriverLogin(
      this.cf['phone_number'].value,
      this.cf['company_code'].value
    ).subscribe({
      next: () => { sessionStorage.setItem('showSidebarOnLoad', 'true'); this.router.navigate(['/dashboard']); },
      error: (err: any) => {
        this.error = err?.error?.detail || 'Numéro ou code société incorrect.';
        this.loading = false;
      },
    });
  }
}
