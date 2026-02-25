import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <span class="logo-text">Mess</span>
          <span class="logo-sub">{{ 'AUTH.BRAND_SUB' | translate }}</span>
        </div>

        <h2>{{ 'AUTH.VERIFY.TITLE' | translate }}</h2>
        <p class="auth-subtitle">
          {{ 'AUTH.VERIFY.SUBTITLE' | translate: { phone: phone } }}
        </p>

        <div class="alert alert-error" *ngIf="error">{{ error | translate }}</div>
        <div class="alert alert-success" *ngIf="success">{{ success | translate }}</div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-group" *ngIf="!phone">
            <label>{{ 'AUTH.VERIFY.PHONE' | translate }}</label>
            <input type="tel" formControlName="phone_number"
              [placeholder]="'AUTH.LOGIN.PHONE_PLACEHOLDER' | translate" />
          </div>

          <div class="otp-group">
            <label>{{ 'AUTH.VERIFY.OTP' | translate }}</label>
            <input type="text" formControlName="otp"
              [placeholder]="'AUTH.VERIFY.OTP_PLACEHOLDER' | translate"
              maxlength="6" inputmode="numeric" class="otp-input"
              [class.invalid]="submitted && f['otp'].errors" />
            <span class="field-error" *ngIf="submitted && f['otp'].errors?.['required']">{{ 'AUTH.VERIFY.OTP_REQUIRED' | translate }}</span>
            <span class="field-error" *ngIf="submitted && f['otp'].errors?.['pattern']">{{ 'AUTH.VERIFY.OTP_PATTERN' | translate }}</span>
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ (loading ? 'AUTH.VERIFY.SUBMITTING' : 'AUTH.VERIFY.SUBMIT') | translate }}
          </button>
        </form>

        <div class="resend-wrap">
          <span>{{ 'AUTH.VERIFY.RESEND_TEXT' | translate }}</span>
          <button class="btn-link" [disabled]="resendCooldown > 0" (click)="resend()">
            {{ resendCooldown > 0
              ? ('AUTH.VERIFY.RESEND_COUNTDOWN' | translate: { count: resendCooldown })
              : ('AUTH.VERIFY.RESEND_BTN' | translate) }}
          </button>
        </div>

        <div class="auth-links">
          <a routerLink="/auth/login">{{ 'AUTH.VERIFY.BACK' | translate }}</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%); padding: 24px; }
    .auth-card { background: white; border-radius: 16px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .auth-logo { display: flex; flex-direction: column; align-items: center; margin-bottom: 28px; }
    .logo-text { font-size: 36px; font-weight: 800; color: #FF6B35; letter-spacing: -1px; }
    .logo-sub { font-size: 11px; color: #757575; text-transform: uppercase; letter-spacing: 2px; margin-top: -4px; }
    h2 { font-size: 22px; font-weight: 700; color: #212121; margin-bottom: 6px; }
    .auth-subtitle { color: #757575; margin-bottom: 24px; font-size: 14px; }
    .form-group, .otp-group { margin-bottom: 20px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #424242; margin-bottom: 8px; }
    input { width: 100%; padding: 12px 14px; border: 1.5px solid #E0E0E0; border-radius: 8px; font-size: 14px; outline: none; transition: border-color .2s; }
    input:focus { border-color: #FF6B35; }
    input.invalid { border-color: #F44336; }
    .otp-input { font-size: 24px; letter-spacing: 8px; text-align: center; font-weight: 700; }
    .field-error { font-size: 11px; color: #F44336; margin-top: 4px; display: block; }
    .btn-primary { width: 100%; padding: 13px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .2s; }
    .btn-primary:hover:not(:disabled) { background: #e55a24; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert-error { background: #FFEBEE; color: #C62828; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
    .alert-success { background: #E8F5E9; color: #2E7D32; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
    .resend-wrap { display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: 16px; font-size: 13px; color: #757575; }
    .btn-link { background: none; border: none; color: #FF6B35; font-weight: 600; cursor: pointer; font-size: 13px; padding: 0; }
    .btn-link:disabled { color: #BDBDBD; cursor: not-allowed; }
    .auth-links { text-align: center; margin-top: 16px; }
    .auth-links a { color: #757575; font-size: 13px; }
  `]
})
export class VerifyOtpComponent implements OnInit {
  form: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  success = '';
  resendCooldown = 0;
  phone = '';

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      phone_number: [''],
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnInit(): void {
    this.phone = sessionStorage.getItem('pending_phone') || '';
    if (this.phone) this.form.patchValue({ phone_number: this.phone });
  }

  get f() { return this.form.controls; }

  submit(): void {
    this.submitted = true;
    this.error = '';
    if (this.form.invalid) return;
    this.loading = true;
    const phone = this.phone || this.f['phone_number'].value;
    this.auth.verifyOtp(phone, this.f['otp'].value).subscribe({
      next: () => {
        this.success = 'AUTH.VERIFY.SUCCESS';
        sessionStorage.removeItem('pending_phone');
        setTimeout(() => this.router.navigate(['/auth/login']), 1500);
      },
      error: () => {
        this.error = 'AUTH.VERIFY.ERROR_INVALID';
        this.loading = false;
      },
    });
  }

  resend(): void {
    const phone = this.phone || this.f['phone_number'].value;
    if (!phone) return;
    this.auth.requestOtp(phone).subscribe({
      next: () => { this.success = 'AUTH.VERIFY.RESEND_SUCCESS'; this.startCooldown(); },
      error: () => { this.error = 'AUTH.VERIFY.RESEND_ERROR'; },
    });
  }

  private startCooldown(): void {
    this.resendCooldown = 60;
    const t = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) clearInterval(t);
    }, 1000);
  }
}
