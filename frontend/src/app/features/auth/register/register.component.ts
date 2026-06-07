import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user.model';
import { LanguageService } from '../../../core/services/language.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw  = group.get('password')?.value;
  const cpw = group.get('password_confirm')?.value;
  return pw && cpw && pw !== cpw ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">

        <!-- Language switcher -->
        <div class="lang-picker">
          <button class="lang-btn" (click)="langOpen = !langOpen">
            <span>{{ langSvc.currentLang().flag }}</span>
            <span class="lang-code">{{ langSvc.currentLang().code | uppercase }}</span>
            <span>▾</span>
          </button>
          <div class="lang-dropdown" *ngIf="langOpen">
            <button *ngFor="let lang of langSvc.languages"
              class="lang-option"
              [class.active]="lang.code === langSvc.current()"
              (click)="selectLang(lang.code)">
              <span>{{ lang.flag }}</span>
              <span>{{ lang.label }}</span>
            </button>
          </div>
        </div>

        <div class="auth-logo">
          <img src="yoolo-logo.jpg" class="logo-img" alt="Yoolo" />
        </div>

        <h2>{{ 'AUTH.REGISTER.TITLE' | translate }}</h2>
        <p class="auth-subtitle">{{ 'AUTH.REGISTER.SUBTITLE' | translate }}</p>

        <div class="alert alert-error" *ngIf="error">{{ error }}</div>
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

          <!-- Role selector with visual cards -->
          <div class="form-group">
            <label>{{ 'AUTH.REGISTER.ROLE' | translate }}</label>
            <div class="role-selector">
              <div class="role-card" [class.role-card--active]="f['role'].value === 'SHIPPER'" (click)="f['role'].setValue('SHIPPER')">
                <span class="role-emoji">📦</span>
                <span class="role-name">{{ 'AUTH.REGISTER.ROLE_SHIPPER' | translate }}</span>
                <span class="role-desc">{{ 'AUTH.REGISTER.ROLE_SHIPPER_DESC' | translate }}</span>
              </div>
              <div class="role-card" [class.role-card--active]="f['role'].value === 'DRIVER'" (click)="f['role'].setValue('DRIVER')">
                <span class="role-emoji">🚚</span>
                <span class="role-name">{{ 'AUTH.REGISTER.ROLE_DRIVER' | translate }}</span>
                <span class="role-desc">{{ 'AUTH.REGISTER.ROLE_DRIVER_DESC' | translate }}</span>
              </div>
            </div>
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

          <div class="form-group">
            <label>{{ 'AUTH.REGISTER.PASSWORD_CONFIRM' | translate }}</label>
            <div class="password-wrap">
              <input [type]="showPwdConfirm ? 'text' : 'password'" formControlName="password_confirm"
                [placeholder]="'AUTH.REGISTER.PASSWORD_CONFIRM_PLACEHOLDER' | translate"
                [class.invalid]="submitted && (f['password_confirm'].errors || form.errors?.['mismatch'])" />
              <button type="button" class="pwd-toggle" (click)="showPwdConfirm = !showPwdConfirm">
                {{ showPwdConfirm ? '🙈' : '👁️' }}
              </button>
            </div>
            <span class="field-error" *ngIf="submitted && form.errors?.['mismatch']">{{ 'AUTH.REGISTER.PASSWORD_MISMATCH' | translate }}</span>
          </div>

          <button type="submit" class="btn-gold w-full" [disabled]="loading">
            {{ (loading ? 'AUTH.REGISTER.SUBMITTING' : 'AUTH.REGISTER.SUBMIT') | translate }}
          </button>
        </form>

        <div class="auth-links" *ngIf="!success">
          <span>{{ 'AUTH.REGISTER.HAS_ACCOUNT' | translate }}</span>
          <a routerLink="/auth/login">{{ 'AUTH.REGISTER.LOGIN_LINK' | translate }}</a>
        </div>

        <div class="text-center mt-3" *ngIf="success">
          <a routerLink="/auth/verify" class="btn-gold" style="display:inline-block;text-decoration:none;padding:12px 28px">
            {{ 'AUTH.REGISTER.VERIFY_LINK' | translate }}
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lang-picker { position: relative; display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .lang-btn {
      display: flex; align-items: center; gap: 6px; padding: 6px 10px;
      background: #F5F3EE; border: 1.5px solid #E5E2DA; border-radius: 8px;
      cursor: pointer; font-size: 13px; font-weight: 600; color: #333;
    }
    .lang-btn:hover { border-color: #C9A227; }
    .lang-code { font-size: 11px; color: #757575; }
    .lang-dropdown {
      position: absolute; top: calc(100% + 4px); right: 0; z-index: 100;
      background: white; border: 1.5px solid #E5E2DA; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12); overflow: hidden; min-width: 130px;
    }
    .lang-option {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 10px 14px; background: none; border: none; cursor: pointer;
      font-size: 13px; color: #333; text-align: left;
    }
    .lang-option:hover { background: #F5F3EE; }
    .lang-option.active { color: #C9A227; font-weight: 700; }

    .auth-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #111111; padding: 24px;
      background-image: radial-gradient(ellipse at 20% 50%, rgba(201,162,39,0.08) 0%, transparent 50%);
    }
    .auth-card {
      background: white; border-radius: 20px; padding: 36px 40px;
      width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      border: 1px solid rgba(201,162,39,0.15);
    }
    .auth-logo { display: flex; justify-content: center; margin-bottom: 24px; }
    .logo-img { height: 48px; width: auto; object-fit: contain; }
    h2 { font-size: 22px; font-weight: 800; color: #1A1A1A; margin-bottom: 6px; }
    .auth-subtitle { color: #757575; margin-bottom: 22px; font-size: 14px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
    input, select {
      width: 100%; padding: 12px 14px; border: 1.5px solid #E5E2DA;
      border-radius: 10px; font-size: 14px; outline: none; transition: border-color .2s;
      background: #FAFAF8; color: #1A1A1A;
    }
    input:focus, select:focus { border-color: #C9A227; }
    input.invalid, select.invalid { border-color: #E53935; }
    .field-error { font-size: 11px; color: #E53935; margin-top: 4px; display: block; }
    .password-wrap { position: relative; }
    .pwd-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 16px; padding: 0; }

    /* Role selector */
    .role-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .role-card {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 14px 10px; border: 2px solid #E5E2DA; border-radius: 12px;
      cursor: pointer; text-align: center; transition: all .2s; background: #FAFAF8;
    }
    .role-card:hover { border-color: #C9A227; background: rgba(201,162,39,0.05); }
    .role-card--active { border-color: #C9A227; background: rgba(201,162,39,0.08); }
    .role-emoji { font-size: 24px; }
    .role-name { font-size: 13px; font-weight: 700; color: #1A1A1A; }
    .role-desc { font-size: 11px; color: #757575; }

    .btn-gold {
      width: 100%; padding: 13px;
      background: linear-gradient(135deg, #C9A227 0%, #A8861F 100%);
      color: #1A1A1A; border: none; border-radius: 10px; font-size: 15px; font-weight: 700;
      cursor: pointer; margin-top: 8px; transition: all .2s;
      box-shadow: 0 4px 14px rgba(201,162,39,0.35);
    }
    .btn-gold:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(201,162,39,0.45); }
    .btn-gold:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert-error { background: #FFEBEE; color: #C62828; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
    .alert-success { background: rgba(201,162,39,0.1); color: #A8861F; border: 1px solid rgba(201,162,39,0.3); border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
    .auth-links { text-align: center; margin-top: 20px; font-size: 13px; color: #757575; display: flex; gap: 6px; justify-content: center; }
    .auth-links a { color: #C9A227; font-weight: 700; }
    .w-full { width: 100%; }
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
  showPwdConfirm = false;

  langOpen = false;

  constructor(private fb: FormBuilder, private auth: AuthService, public langSvc: LanguageService) {
    this.form = this.fb.group({
      full_name:        ['', Validators.required],
      phone_number:     ['', Validators.required],
      role:             ['', Validators.required],
      password:         ['', [Validators.required, Validators.minLength(8)]],
      password_confirm: ['', Validators.required],
    }, { validators: passwordsMatch });
  }

  selectLang(code: string): void { this.langSvc.use(code); this.langOpen = false; }

  get f() { return this.form.controls; }

  submit(): void {
    this.submitted = true;
    this.error = '';
    if (this.form.invalid) return;
    this.loading = true;

    const fullName: string = this.f['full_name'].value.trim();
    const spaceIdx = fullName.indexOf(' ');
    const first_name = spaceIdx > -1 ? fullName.slice(0, spaceIdx) : fullName;
    const last_name  = spaceIdx > -1 ? fullName.slice(spaceIdx + 1).trim() : '';

    this.auth.register({
      phone_number:     this.f['phone_number'].value,
      first_name,
      last_name,
      role:             this.f['role'].value as UserRole,
      password:         this.f['password'].value,
      password_confirm: this.f['password_confirm'].value,
    }).subscribe({
      next: () => {
        this.success = 'AUTH.REGISTER.SUCCESS';
        sessionStorage.setItem('pending_phone', this.f['phone_number'].value);
        this.loading = false;
      },
      error: (err: any) => {
        const envelope = err?.error?.error;
        if (envelope?.message) {
          this.error = envelope.message;
        } else if (envelope?.detail && typeof envelope.detail === 'object') {
          this.error = Object.values(envelope.detail)
            .map((msgs: any) => Array.isArray(msgs) ? msgs.join(', ') : String(msgs))
            .join(' | ');
        } else {
          this.error = 'AUTH.REGISTER.ERROR_GENERIC';
        }
        this.loading = false;
      },
    });
  }
}
