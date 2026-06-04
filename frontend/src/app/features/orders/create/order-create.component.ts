import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/services/api.service';
import { AddressSearchComponent, LocationResult } from '../../../shared/components/address-search/address-search.component';

@Component({
  selector: 'app-order-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, AddressSearchComponent],
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
              <input type="number" formControlName="weight_kg" placeholder="1500" min="1" [class.invalid]="isInvalid('weight_kg')" />
              <span class="field-error" *ngIf="isInvalid('weight_kg')">{{ 'COMMON.REQUIRED' | translate }}</span>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.CARGO_VOLUME' | translate }}</label>
              <input type="number" formControlName="volume_m3"
                [placeholder]="'COMMON.OPTIONAL' | translate" min="0" step="0.1" />
            </div>
            <div class="form-group full-width">
              <label>{{ 'ORDERS.CREATE.CARGO_DESC' | translate }}</label>
              <textarea formControlName="cargo_description" rows="2"
                [placeholder]="'ORDERS.CREATE.CARGO_DESC_PLACEHOLDER' | translate"
                [class.invalid]="isInvalid('cargo_description')"></textarea>
              <span class="field-error" *ngIf="isInvalid('cargo_description')">{{ 'COMMON.REQUIRED' | translate }}</span>
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
            <div class="form-group full-width">
              <label>{{ 'ORDERS.CREATE.PICKUP_ADDRESS' | translate }}</label>
              <app-address-search
                [placeholder]="'ORDERS.CREATE.PICKUP_ADDRESS_PLACEHOLDER' | translate"
                (locationSelected)="onPickupSelected($event)" />
              <span class="field-error" *ngIf="isInvalid('pickup_address')">{{ 'COMMON.REQUIRED' | translate }}</span>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.PICKUP_CITY' | translate }}</label>
              <input type="text" formControlName="pickup_city"
                [placeholder]="'ORDERS.CREATE.PICKUP_CITY_PLACEHOLDER' | translate"
                [class.invalid]="isInvalid('pickup_city')" />
              <span class="field-error" *ngIf="isInvalid('pickup_city')">{{ 'COMMON.REQUIRED' | translate }}</span>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.PICKUP_DATE' | translate }}</label>
              <input type="datetime-local" formControlName="pickup_scheduled_at"
                [min]="minPickupDate"
                [class.invalid]="isInvalid('pickup_scheduled_at')" />
              <span class="field-error" *ngIf="isInvalid('pickup_scheduled_at')">{{ 'COMMON.REQUIRED' | translate }}</span>
            </div>
          </div>
        </div>

        <!-- Section: Delivery -->
        <div class="card">
          <h3>{{ 'ORDERS.CREATE.DELIVERY_SECTION' | translate }}</h3>
          <div class="form-grid">
            <div class="form-group full-width">
              <label>{{ 'ORDERS.CREATE.DELIVERY_ADDRESS' | translate }}</label>
              <app-address-search
                [placeholder]="'ORDERS.CREATE.DELIVERY_ADDRESS_PLACEHOLDER' | translate"
                (locationSelected)="onDeliverySelected($event)" />
              <span class="field-error" *ngIf="isInvalid('delivery_address')">{{ 'COMMON.REQUIRED' | translate }}</span>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.DELIVERY_CITY' | translate }}</label>
              <input type="text" formControlName="delivery_city"
                [placeholder]="'ORDERS.CREATE.DELIVERY_CITY_PLACEHOLDER' | translate"
                [class.invalid]="isInvalid('delivery_city')" />
              <span class="field-error" *ngIf="isInvalid('delivery_city')">{{ 'COMMON.REQUIRED' | translate }}</span>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.CREATE.DELIVERY_DEADLINE' | translate }}</label>
              <input type="datetime-local" formControlName="delivery_deadline" [min]="minDeliveryDate()" />
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
    .form-group { position: relative; }
    label { display: block; font-size: 13px; font-weight: 600; color: #424242; margin-bottom: 6px; }
    input, select, textarea {
      width: 100%; padding: 10px 12px; border: 1.5px solid #E0E0E0;
      border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box;
    }
    input:focus, select:focus, textarea:focus { border-color: #FF6B35; }
    input.invalid, textarea.invalid { border-color: #F44336; }
    textarea { resize: vertical; }
    .field-error { display: block; color: #F44336; font-size: 11px; margin-top: 4px; }
    .form-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 8px; }
    .btn-primary { padding: 11px 24px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #e55a24; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 11px 24px; background: #F5F5F5; color: #424242; border: 1px solid #E0E0E0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
    .alert-error { background: #FFEBEE; color: #C62828; padding: 14px; margin-bottom: 16px; }
    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } .full-width { grid-column: 1; } }
  `]
})
export class OrderCreateComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  loading = signal(false);
  error = signal('');

  /** Today in YYYY-MM-DDTHH:mm for datetime-local min */
  minPickupDate = new Date().toISOString().slice(0, 16);

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
    pickup_lat:           [null as number | null],
    pickup_lng:           [null as number | null],
    pickup_scheduled_at:  ['', Validators.required],
    delivery_address:     ['', Validators.required],
    delivery_city:        ['', Validators.required],
    delivery_lat:         [null as number | null],
    delivery_lng:         [null as number | null],
    delivery_deadline:    [''],
    proposed_price:       [null as number | null],
    special_instructions: [''],
  });

  ngOnInit(): void {}

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  /** Min datetime for delivery deadline: pickup datetime if set, else now */
  minDeliveryDate(): string {
    const pickup = this.form.get('pickup_scheduled_at')?.value;
    if (pickup) return pickup.slice(0, 16);
    return new Date().toISOString().slice(0, 16);
  }

  onPickupSelected(loc: LocationResult): void {
    this.form.patchValue({
      pickup_address: loc.address,
      pickup_city: loc.city || this.form.get('pickup_city')?.value || '',
      pickup_lat: loc.lat ?? null,
      pickup_lng: loc.lng ?? null,
    });
    this.form.get('pickup_address')?.markAsTouched();
  }

  onDeliverySelected(loc: LocationResult): void {
    this.form.patchValue({
      delivery_address: loc.address,
      delivery_city: loc.city || this.form.get('delivery_city')?.value || '',
      delivery_lat: loc.lat ?? null,
      delivery_lng: loc.lng ?? null,
    });
    this.form.get('delivery_address')?.markAsTouched();
  }

  submit(andPost = true): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(this.translate.instant('ORDERS.CREATE.ERROR_GENERIC'));
      setTimeout(() => this.error.set(''), 4000);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const v = { ...this.form.value } as any;
    // datetime-local sends "YYYY-MM-DDTHH:mm" (no seconds) — DRF requires seconds
    if (v.pickup_scheduled_at && v.pickup_scheduled_at.length === 16) {
      v.pickup_scheduled_at = v.pickup_scheduled_at + ':00';
    }
    if (v.delivery_deadline && v.delivery_deadline.length === 16) {
      v.delivery_deadline = v.delivery_deadline + ':00';
    } else if (!v.delivery_deadline) {
      v.delivery_deadline = null;
    }
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
