import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="profile-page">
      <h1>{{ 'PROFILE.TITLE' | translate }}</h1>

      <div class="profile-layout">
        <!-- Avatar + info -->
        <div class="card profile-card">
          <div class="avatar-section">
            <div class="avatar">{{ initials() }}</div>
            <div>
              <h2>{{ auth.user()?.full_name }}</h2>
              <div class="role-badge">{{ roleLabel(auth.user()?.role) }}</div>
              <div class="phone text-muted text-sm">{{ auth.user()?.phone_number }}</div>
            </div>
          </div>

          <div class="stats-row" *ngIf="auth.role() === 'DRIVER' && auth.user()?.driver_profile">
            <div class="stat">
              <div class="stat-val">{{ auth.user()!.driver_profile!.rating_avg | number:'1.1-1' }}</div>
              <div class="stat-key">{{ 'PROFILE.RATING' | translate }}</div>
            </div>
            <div class="stat">
              <div class="stat-val">{{ auth.user()!.driver_profile!.total_trips }}</div>
              <div class="stat-key">{{ 'PROFILE.TRIPS' | translate }}</div>
            </div>
            <div class="stat">
              <div class="stat-val">{{ auth.user()!.driver_profile!.rating_count }}</div>
              <div class="stat-key">{{ 'PROFILE.REVIEWS' | translate }}</div>
            </div>
          </div>

          <div class="verify-status" [class.verified]="auth.user()?.is_verified">
            {{ auth.user()?.is_verified ? 'PROFILE.VERIFIED' : 'PROFILE.NOT_VERIFIED' | translate }}
          </div>
        </div>

        <!-- Edit form -->
        <div class="card">
          <h3>{{ 'PROFILE.EDIT_INFO' | translate }}</h3>

          <div class="alert-success" *ngIf="saved()">{{ 'PROFILE.SAVED_SUCCESS' | translate }}</div>
          <div class="alert-error" *ngIf="error()">{{ error() }}</div>

          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="form-group">
              <label>{{ 'PROFILE.FULL_NAME' | translate }}</label>
              <input type="text" formControlName="full_name" />
            </div>

            <!-- Driver-specific -->
            <ng-container *ngIf="auth.role() === 'DRIVER'" formGroupName="driver_profile">
              <div class="form-group">
                <label>{{ 'PROFILE.LICENSE_NUMBER' | translate }}</label>
                <input type="text" formControlName="license_number" />
              </div>
              <div class="form-group">
                <label>{{ 'PROFILE.LICENSE_CLASS' | translate }}</label>
                <input type="text" formControlName="license_class" />
              </div>
            </ng-container>

            <!-- Shipper-specific -->
            <ng-container *ngIf="auth.role() === 'SHIPPER'" formGroupName="shipper_profile">
              <div class="form-group">
                <label>{{ 'PROFILE.COMPANY_NAME' | translate }}</label>
                <input type="text" formControlName="company_name" />
              </div>
              <div class="form-group">
                <label>{{ 'PROFILE.BUSINESS_ADDRESS' | translate }}</label>
                <input type="text" formControlName="business_address" />
              </div>
            </ng-container>

            <button type="submit" class="btn-primary" [disabled]="saving()">
              {{ saving() ? 'PROFILE.SAVING' : 'PROFILE.SAVE' | translate }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { max-width: 900px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
    h2 { font-size: 18px; font-weight: 700; }
    h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
    .profile-layout { display: grid; grid-template-columns: 320px 1fr; gap: 20px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .avatar-section { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .avatar { width: 64px; height: 64px; border-radius: 50%; background: #FF6B35; color: white; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; flex-shrink: 0; }
    .role-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; background: #FFF3E0; color: #E65100; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
    .phone { margin-top: 4px; }
    .stats-row { display: flex; gap: 16px; padding: 16px 0; border-top: 1px solid #F0F0F0; margin-top: 16px; }
    .stat { text-align: center; flex: 1; }
    .stat-val { font-size: 22px; font-weight: 800; color: #FF6B35; }
    .stat-key { font-size: 11px; color: #757575; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .verify-status { margin-top: 16px; font-size: 13px; font-weight: 600; color: #F44336; }
    .verify-status.verified { color: #00C896; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #424242; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 12px; border: 1.5px solid #E0E0E0; border-radius: 8px; font-size: 14px; outline: none; }
    input:focus { border-color: #FF6B35; }
    .btn-primary { padding: 11px 24px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert-success { background: #E8F5E9; color: #2E7D32; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
    .alert-error { background: #FFEBEE; color: #C62828; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
    .text-sm { font-size: 12px; } .text-muted { color: #757575; }
    @media (max-width: 768px) { .profile-layout { grid-template-columns: 1fr; } }
  `]
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  saving = signal(false);
  saved = signal(false);
  error = signal('');

  form = this.fb.group({
    full_name: ['', Validators.required],
    driver_profile: this.fb.group({ license_number: [''], license_class: [''] }),
    shipper_profile: this.fb.group({ company_name: [''], business_address: [''] }),
  });

  ngOnInit(): void {
    const u = this.auth.user();
    if (!u) return;
    this.form.patchValue({
      full_name: u.full_name,
      driver_profile: u.driver_profile as any ?? {},
      shipper_profile: u.shipper_profile as any ?? {},
    });
  }

  initials(): string {
    return (this.auth.user()?.full_name ?? '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  roleLabel(r?: string): string {
    const map: Record<string, string> = {
      SHIPPER: 'PROFILE.ROLE_SHIPPER', DRIVER: 'PROFILE.ROLE_DRIVER', BROKER: 'PROFILE.ROLE_BROKER',
      FLEET_MANAGER: 'PROFILE.ROLE_FLEET_MANAGER', ADMIN: 'PROFILE.ROLE_ADMIN',
    };
    return r ? (map[r] ?? r) : '';
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.saved.set(false);
    this.error.set('');
    this.api.updateMe(this.form.value as any).subscribe({
      next: (u) => { this.auth.updateProfile(u); this.saved.set(true); this.saving.set(false); },
      error: (err) => { this.error.set(err?.error?.error?.message || 'PROFILE.ERROR_UPDATE'); this.saving.set(false); },
    });
  }
}
