import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <span class="logo-text">Mess</span>
          <span class="logo-sub">{{ 'AUTH.BRAND_SUB' | translate }}</span>
        </div>

        <h2>{{ 'AUTH.REGISTER.TITLE' | translate }}</h2>
        <p class="auth-subtitle">{{ 'AUTH.REGISTER.SUBTITLE' | translate }}</p>

        <div class="alert alert-error" *ngIf="error">{{ error | translate }}</div>
        <div class="alert alert-success" *ngIf="success">{{ success | translate }}</div>

        <form [formGroup]="form" (ngSubmit)="submit()" *ngIf="!success">
          <div class="form-group">
            <label>{{ 'AUTH.REGISTER.FULL_NAME' | translate }}</label>
            <input type="text" formControlName="full_name"
              [placeholder]="'AUTH.REGISTER.FULL_NAME_PLACEHOLDER' | translate"
              [class.invalid]="submitted && f['full_name'].errors" />
            <span class="field-error" *ngIf="submitted && f['full_name'].errors?.['required']">{{ 'COMMON.REQUIRED' | translate }}</span>
          </div>

          <div class="form-group">
            <label>{{ 'AUTH.REGISTER.PHONE' | translate }}</label>
            <input type="tel" formControlName="phone_number"
              [placeholder]="'AUTH.LOGIN.PHONE_PLACEHOLDER' | translate"
              [class.invalid]="submitted && f['phone_number'].errors" />
            <span class="field-error" *ngIf="submitted && f['phone_number'].errors?.['required']">{{ 'COMMON.REQUIRED' | translate }}</span>
          </div>

          <div class="form-group">
            <label>{{ 'AUTH.REGISTER.ROLE' | translate }}</label>
            <select formControlName="role" [class.invalid]="submitted && f['role'].errors">
              <option value="">{{ 'AUTH.REGISTER.ROLE_SELECT' | translate }}</option>
              <option value="SHIPPER">{{ 'AUTH.REGISTER.ROLE_SHIPPER' | translate }}</option>
              <option value="DRIVER">{{ 'AUTH.REGISTER.ROLE_DRIVER' | translate }}</option>
              <option value="BROKER">{{ 'AUTH.REGISTER.ROLE_BROKER' | translate }}</option>
              <option value="FLEET_MANAGER">{{ 'AUTH.REGISTER.ROLE_FLEET_MANAGER' | translate }}</option>
            </select>
            <span class="field-error" *ngIf="submitted && f['role'].errors?.['required']">{{ 'COMMON.REQUIRED' | translate }}</span>
          </div>

          <div class="form-group">
            <label>{{ 'AUTH.REGISTER.PASSWORD' | translate }}</label>
            <div class="password-wrap">
              <input [type]="showPwd ? 'text' : 'password'" formControlName="password"
                [placeholder]="'AUTH.REGISTER.PASSWORD_PLACEHOLDER' | translate"
                [class.invalid]="submitted && f['password'].errors" />
              <button type="button" class="pwd-toggle" (click)="showPwd = !showPwd">
                {{ showPwd ? '🙈' : '👁️' }}
              </button>
            </div>
            <span class="field-error" *ngIf="submitted && f['password'].errors?.['minlength']">{{ 'AUTH.REGISTER.PASSWORD_MIN' | translate }}</span>
          </div>

          <button type="submit" class="btn-primary w-full" [disabled]="loading">
            {{ (loading ? 'AUTH.REGISTER.SUBMITTING' : 'AUTH.REGISTER.SUBMIT') | translate }}
          </button>
        </form>

        <div class="auth-links" *ngIf="!success">
          <span>{{ 'AUTH.REGISTER.HAS_ACCOUNT' | translate }}</span>
          <a routerLink="/auth/login">{{ 'AUTH.REGISTER.LOGIN_LINK' | translate }}</a>
        </div>

        <div class="text-center mt-3" *ngIf="success">
          <a routerLink="/auth/verify" class="btn-primary" style="display:inline-block;text-decoration:none">
            {{ 'AUTH.REGISTER.VERIFY_LINK' | translate }}
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%); padding: 24px; }
    .auth-card { background: white; border-radius: 16px; padding: 40px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .auth-logo { display: flex; flex-direction: column; align-items: center; margin-bottom: 28px; }
    .logo-text { font-size: 36px; font-weight: 800; color: #FF6B35; letter-spacing: -1px; }
    .logo-sub { font-size: 11px; color: #757575; text-transform: uppercase; letter-spacing: 2px; margin-top: -4px; }
    h2 { font-size: 22px; font-weight: 700; color: #212121; margin-bottom: 6px; }
    .auth-subtitle { color: #757575; margin-bottom: 24px; font-size: 14px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #424242; margin-bottom: 6px; }
    input, select { width: 100%; padding: 12px 14px; border: 1.5px solid #E0E0E0; border-radius: 8px; font-size: 14px; outline: none; transition: border-color .2s; background: white; }
    input:focus, select:focus { border-color: #FF6B35; }
    input.invalid, select.invalid { border-color: #F44336; }
    .field-error { font-size: 11px; color: #F44336; margin-top: 4px; display: block; }
    .password-wrap { position: relative; }
    .pwd-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 16px; padding: 0; }
    .btn-primary { width: 100%; padding: 13px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; transition: background .2s; }
    .btn-primary:hover:not(:disabled) { background: #e55a24; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert-error { background: #FFEBEE; color: #C62828; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
    .alert-success { background: #E8F5E9; color: #2E7D32; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
    .auth-links { text-align: center; margin-top: 20px; font-size: 13px; color: #757575; display: flex; gap: 6px; justify-content: center; }
    .auth-links a { color: #FF6B35; font-weight: 600; }
    .mt-3 { margin-top: 24px; } .text-center { text-align: center; }
  `]
})
export class RegisterComponent {
  form: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  success = '';
  showPwd = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      full_name: ['', Validators.required],
      phone_number: ['', Validators.required],
      role: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  get f() { return this.form.controls; }

  submit(): void {
    this.submitted = true;
    this.error = '';
    if (this.form.invalid) return;
    this.loading = true;
    this.auth.register(this.form.value).subscribe({
      next: () => {
        this.success = 'AUTH.REGISTER.SUCCESS';
        sessionStorage.setItem('pending_phone', this.f['phone_number'].value);
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.error?.message || JSON.stringify(err?.error) || 'AUTH.REGISTER.ERROR_GENERIC';
        this.loading = false;
      },
    });
  }
}
