import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-order-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="create-page">
      <a routerLink="/orders" class="back-link">{{ 'ORDERS.CREATE.BACK' | translate }}</a>
      <h1>{{ 'ORDERS.CREATE.TITLE' | translate }}</h1>

      <div class="alert-error card" *ngIf="error()">{{ error() }}</div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="create-form">
        <!-- Section: Cargo -->
        <div class="card">
          <h3>{{ 'ORDERS.CREATE.CARGO_SECTION' | translate }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.CARGO_TYPE' | translate }}</label>
              <select formControlName="cargo_type">
                <option *ngFor="let t of cargoTypes" [value]="t.value">
                  {{ t.labelKey | translate }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.CARGO_WEIGHT' | translate }}</label>
              <input type="number" formControlName="weight_kg" placeholder="1500" min="1" />
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.CARGO_VOLUME' | translate }}</label>
              <input type="number" formControlName="volume_m3"
                [placeholder]="'COMMON.OPTIONAL' | translate" min="0" step="0.1" />
            </div>
            <div class="form-group full-width">
              <label>{{ 'ORDERS.CREATE.CARGO_DESC' | translate }}</label>
              <textarea formControlName="cargo_description" rows="2"
                [placeholder]="'ORDERS.CREATE.CARGO_DESC_PLACEHOLDER' | translate"></textarea>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.CARGO_BUDGET' | translate }}</label>
              <input type="number" formControlName="proposed_price"
                [placeholder]="'COMMON.OPTIONAL' | translate" min="0" />
            </div>
          </div>
        </div>

        <!-- Section: Pickup -->
        <div class="card">
          <h3>{{ 'ORDERS.CREATE.PICKUP_SECTION' | translate }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.PICKUP_CITY' | translate }}</label>
              <input type="text" formControlName="pickup_city"
                [placeholder]="'ORDERS.CREATE.PICKUP_CITY_PLACEHOLDER' | translate" />
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.PICKUP_DATE' | translate }}</label>
              <input type="datetime-local" formControlName="pickup_scheduled_at" />
            </div>
            <div class="form-group full-width">
              <label>{{ 'ORDERS.CREATE.PICKUP_ADDRESS' | translate }}</label>
              <input type="text" formControlName="pickup_address"
                [placeholder]="'ORDERS.CREATE.PICKUP_ADDRESS_PLACEHOLDER' | translate" />
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.PICKUP_LAT' | translate }}</label>
              <input type="number" formControlName="pickup_lat" placeholder="14.6928" step="any" />
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.PICKUP_LNG' | translate }}</label>
              <input type="number" formControlName="pickup_lng" placeholder="-17.4467" step="any" />
            </div>
          </div>
        </div>

        <!-- Section: Delivery -->
        <div class="card">
          <h3>{{ 'ORDERS.CREATE.DELIVERY_SECTION' | translate }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.DELIVERY_CITY' | translate }}</label>
              <input type="text" formControlName="delivery_city"
                [placeholder]="'ORDERS.CREATE.DELIVERY_CITY_PLACEHOLDER' | translate" />
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.DELIVERY_DEADLINE' | translate }}</label>
              <input type="date" formControlName="delivery_deadline" />
            </div>
            <div class="form-group full-width">
              <label>{{ 'ORDERS.CREATE.DELIVERY_ADDRESS' | translate }}</label>
              <input type="text" formControlName="delivery_address"
                [placeholder]="'ORDERS.CREATE.DELIVERY_ADDRESS_PLACEHOLDER' | translate" />
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.DELIVERY_LAT' | translate }}</label>
              <input type="number" formControlName="delivery_lat" placeholder="14.7833" step="any" />
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.DELIVERY_LNG' | translate }}</label>
              <input type="number" formControlName="delivery_lng" placeholder="-16.9167" step="any" />
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="card">
          <h3>{{ 'ORDERS.CREATE.NOTES_SECTION' | translate }}</h3>
          <textarea formControlName="special_instructions" rows="3"
            [placeholder]="'ORDERS.CREATE.NOTES_PLACEHOLDER' | translate"></textarea>
        </div>

        <div class="form-actions">
          <a routerLink="/orders" class="btn-secondary">{{ 'COMMON.CANCEL' | translate }}</a>
          <button type="button" class="btn-secondary" (click)="submit(false)" [disabled]="loading()">
            {{ 'ORDERS.CREATE.SAVE_DRAFT' | translate }}
          </button>
          <button type="submit" class="btn-primary" [disabled]="loading()">
            {{ (loading() ? 'ORDERS.CREATE.CREATING' : 'ORDERS.CREATE.PUBLISH') | translate }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .create-page { max-width: 800px; }
    .back-link { display: inline-block; color: #757575; font-size: 13px; margin-bottom: 12px; text-decoration: none; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
    h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 16px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .full-width { grid-column: 1 / -1; }
    .form-group { }
    label { display: block; font-size: 13px; font-weight: 600; color: #424242; margin-bottom: 6px; }
    input, select, textarea {
      width: 100%; padding: 10px 12px; border: 1.5px solid #E0E0E0;
      border-radius: 8px; font-size: 14px; outline: none; font-family: inherit;
    }
    input:focus, select:focus, textarea:focus { border-color: #FF6B35; }
    textarea { resize: vertical; }
    .form-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 8px; }
    .btn-primary { padding: 11px 24px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #e55a24; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 11px 24px; background: #F5F5F5; color: #424242; border: 1px solid #E0E0E0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
    .alert-error { background: #FFEBEE; color: #C62828; padding: 14px; margin-bottom: 16px; }
  `]
})
export class OrderCreateComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  loading = signal(false);
  error = signal('');

  cargoTypes = [
    { value: 'GENERAL',      labelKey: 'ORDERS.CREATE.CARGO_TYPES.GENERAL' },
    { value: 'REFRIGERATED', labelKey: 'ORDERS.CREATE.CARGO_TYPES.REFRIGERATED' },
    { value: 'HAZARDOUS',    labelKey: 'ORDERS.CREATE.CARGO_TYPES.HAZARDOUS' },
    { value: 'LIVESTOCK',    labelKey: 'ORDERS.CREATE.CARGO_TYPES.LIVESTOCK' },
    { value: 'BULK',         labelKey: 'ORDERS.CREATE.CARGO_TYPES.BULK' },
    { value: 'CONSTRUCTION', labelKey: 'ORDERS.CREATE.CARGO_TYPES.CONSTRUCTION' },
    { value: 'ELECTRONICS',  labelKey: 'ORDERS.CREATE.CARGO_TYPES.ELECTRONICS' },
  ];

  form = this.fb.group({
    cargo_type:           ['GENERAL', Validators.required],
    cargo_description:    ['', Validators.required],
    weight_kg:            [null as number | null, [Validators.required, Validators.min(1)]],
    volume_m3:            [null as number | null],
    pickup_address:       ['', Validators.required],
    pickup_city:          ['', Validators.required],
    pickup_lat:           [14.6928, Validators.required],
    pickup_lng:           [-17.4467, Validators.required],
    pickup_scheduled_at:  ['', Validators.required],
    delivery_address:     ['', Validators.required],
    delivery_city:        ['', Validators.required],
    delivery_lat:         [null as number | null, Validators.required],
    delivery_lng:         [null as number | null, Validators.required],
    delivery_deadline:    [''],
    proposed_price:       [null as number | null],
    special_instructions: [''],
  });

  submit(andPost = true): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    const v = this.form.value as any;
    this.api.createOrder(v).subscribe({
      next: (order: any) => {
        if (andPost) {
          this.api.postOrder(order.id).subscribe({
            next: () => this.router.navigate(['/orders', order.id]),
            error: () => this.router.navigate(['/orders', order.id]),
          });
        } else {
          this.router.navigate(['/orders', order.id]);
        }
      },
      error: (err) => {
        this.error.set(
          err?.error?.error?.message ||
          this.translate.instant('ORDERS.CREATE.ERROR_GENERIC')
        );
        this.loading.set(false);
      },
    });
  }
}
