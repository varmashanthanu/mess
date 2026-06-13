import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { FreightOrder } from '../../../core/models/order.model';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="detail-page" *ngIf="order(); else loadingTpl">
      <!-- Back -->
      <a routerLink="/orders" class="back-link">{{ 'ORDERS.DETAIL.BACK' | translate }}</a>

      <div class="detail-layout">
        <!-- Main -->
        <div class="detail-main">
          <!-- Header -->
          <div class="card detail-header">
            <div class="header-top">
              <div>
                <h1>{{ order()!.reference }}</h1>
                <span class="badge badge--{{ order()!.status.toLowerCase() }}">
                  {{ statusLabel(order()!.status) }}
                </span>
              </div>
              <div class="header-actions">
                <button class="btn-action btn-orange"
                  *ngIf="order()!.status === 'DRAFT' && auth.hasRole('SHIPPER', 'ADMIN')"
                  (click)="postOrder()">
                  {{ 'ORDERS.DETAIL.PUBLISH' | translate }}
                </button>
                <!-- Driver: accept posted order -->
                <button class="btn-action btn-orange"
                  *ngIf="order()!.status === 'POSTED' && auth.hasRole('DRIVER')"
                  (click)="acceptOrder()">
                  {{ 'ORDERS.DETAIL.ACCEPT_ORDER' | translate }}
                </button>
                <!-- Driver: confirm pickup (first time) -->
                <button class="btn-action btn-orange"
                  *ngIf="order()!.status === 'ASSIGNED' && isAssignedDriver()"
                  (click)="showPickupForm.set(!showPickupForm())">
                  📦 {{ 'ORDERS.DETAIL.CONFIRM_PICKUP' | translate }}
                </button>
                <!-- Driver: re-upload pickup proof (already in transit) -->
                <button class="btn-action btn-orange"
                  *ngIf="order()!.status === 'IN_TRANSIT' && isAssignedDriver()"
                  (click)="showPickupForm.set(!showPickupForm())">
                  📷 {{ 'ORDERS.DETAIL.REUPLOAD_PICKUP' | translate }}
                </button>
                <!-- Driver: revert to assigned (pickup was submitted by mistake) -->
                <button class="btn-action btn-ghost"
                  *ngIf="order()!.status === 'IN_TRANSIT' && isAssignedDriver()"
                  (click)="revertPickup()">
                  ↩ {{ 'ORDERS.DETAIL.REVERT_TO_ASSIGNED' | translate }}
                </button>
                <!-- Driver: submit delivery proof (first time) -->
                <button class="btn-action btn-green"
                  *ngIf="order()!.status === 'IN_TRANSIT' && isAssignedDriver()"
                  (click)="showDeliveryForm.set(!showDeliveryForm())">
                  🏁 {{ 'ORDERS.DETAIL.SUBMIT_DELIVERY_PROOF' | translate }}
                </button>
                <!-- Driver: re-upload delivery proof (delivered but shipper hasn't confirmed) -->
                <button class="btn-action btn-green"
                  *ngIf="order()!.status === 'DELIVERED' && isAssignedDriver() && !order()!.assignment?.delivery_confirmed_by_shipper"
                  (click)="showDeliveryForm.set(!showDeliveryForm())">
                  📷 {{ 'ORDERS.DETAIL.REUPLOAD_DELIVERY' | translate }}
                </button>
                <!-- Shipper: confirm delivery -->
                <button class="btn-action btn-green"
                  *ngIf="order()!.status === 'DELIVERED' && auth.hasRole('SHIPPER')"
                  (click)="confirmDelivery()">
                  ✅ {{ 'ORDERS.DETAIL.CONFIRM_DELIVERY' | translate }}
                </button>
                <button class="btn-action btn-red"
                  *ngIf="canCancel()"
                  (click)="cancelOrder()">
                  {{ 'ORDERS.DETAIL.CANCEL_ORDER' | translate }}
                </button>
              </div>
            </div>
          </div>

          <!-- Action error -->
          <div class="alert-error" *ngIf="actionError()">{{ actionError() }}</div>

          <!-- Pickup proof form (driver, ASSIGNED = first upload / IN_TRANSIT = re-upload) -->
          <div class="card proof-card" *ngIf="showPickupForm()">
            <h3>📦 {{ (order()!.status === 'IN_TRANSIT' ? 'ORDERS.DETAIL.REUPLOAD_PICKUP_TITLE' : 'ORDERS.DETAIL.PICKUP_PROOF_TITLE') | translate }}</h3>
            <p class="proof-hint">{{ 'ORDERS.DETAIL.PICKUP_PROOF_HINT' | translate }}</p>
            <div class="form-group">
              <label>{{ 'ORDERS.DETAIL.PROOF_PHOTO' | translate }}</label>
              <div class="file-input-row">
                <label class="file-btn">
                  📷 {{ 'ORDERS.DETAIL.CHOOSE_PHOTO' | translate }}
                  <input type="file" accept="image/*" (change)="onPickupPhotoChange($event)" hidden />
                </label>
                <span class="file-name text-muted text-sm">{{ pickupPhotoName() || ('ORDERS.DETAIL.NO_FILE' | translate) }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.DETAIL.PROOF_NOTE' | translate }}</label>
              <textarea rows="2" [(ngModel)]="pickupNote" [placeholder]="'ORDERS.DETAIL.PROOF_NOTE_PLACEHOLDER' | translate"></textarea>
            </div>
            <div class="proof-actions">
              <button class="btn-action btn-orange" (click)="submitPickupProof()" [disabled]="pickupSubmitting()">
                {{ (pickupSubmitting() ? 'COMMON.SUBMITTING' : (order()!.status === 'IN_TRANSIT' ? 'ORDERS.DETAIL.UPDATE_PICKUP' : 'ORDERS.DETAIL.SUBMIT_PICKUP')) | translate }}
              </button>
              <button class="btn-action btn-ghost" (click)="showPickupForm.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
            </div>
          </div>

          <!-- Delivery proof form (driver, IN_TRANSIT = first upload / DELIVERED = re-upload) -->
          <div class="card proof-card" *ngIf="showDeliveryForm()">
            <h3>🏁 {{ (order()!.status === 'DELIVERED' ? 'ORDERS.DETAIL.REUPLOAD_DELIVERY_TITLE' : 'ORDERS.DETAIL.DELIVERY_PROOF_TITLE') | translate }}</h3>
            <p class="proof-hint">{{ 'ORDERS.DETAIL.DELIVERY_PROOF_HINT' | translate }}</p>
            <div class="form-group">
              <label>{{ 'ORDERS.DETAIL.PROOF_PHOTO' | translate }}</label>
              <div class="file-input-row">
                <label class="file-btn">
                  📷 {{ 'ORDERS.DETAIL.CHOOSE_PHOTO' | translate }}
                  <input type="file" accept="image/*" (change)="onDeliveryPhotoChange($event)" hidden />
                </label>
                <span class="file-name text-muted text-sm">{{ deliveryPhotoName() || ('ORDERS.DETAIL.NO_FILE' | translate) }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'ORDERS.DETAIL.PROOF_NOTE' | translate }}</label>
              <textarea rows="2" [(ngModel)]="deliveryNote" [placeholder]="'ORDERS.DETAIL.PROOF_NOTE_PLACEHOLDER' | translate"></textarea>
            </div>
            <div class="proof-actions">
              <button class="btn-action btn-green" (click)="submitDeliveryProof()" [disabled]="deliverySubmitting()">
                {{ (deliverySubmitting() ? 'COMMON.SUBMITTING' : (order()!.status === 'DELIVERED' ? 'ORDERS.DETAIL.UPDATE_DELIVERY' : 'ORDERS.DETAIL.SUBMIT_DELIVERY')) | translate }}
              </button>
              <button class="btn-action btn-ghost" (click)="showDeliveryForm.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
            </div>
          </div>

          <!-- Route -->
          <div class="card">
            <h3>{{ 'ORDERS.DETAIL.ROUTE_TITLE' | translate }}</h3>
            <div class="route-display">
              <div class="route-point pickup">
                <div class="route-dot">📍</div>
                <div>
                  <div class="route-city">{{ order()!.pickup_city }}</div>
                  <div class="route-address">{{ order()!.pickup_address }}</div>
                  <div class="route-date">{{ order()!.pickup_scheduled_at | date:'dd/MM/yyyy HH:mm' }}</div>
                </div>
              </div>
              <div class="route-line"></div>
              <div class="route-point delivery">
                <div class="route-dot">🏁</div>
                <div>
                  <div class="route-city">{{ order()!.delivery_city }}</div>
                  <div class="route-address">{{ order()!.delivery_address }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Cargo -->
          <div class="card">
            <h3>{{ 'ORDERS.DETAIL.CARGO_TITLE' | translate }}</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-key">{{ 'ORDERS.DETAIL.CARGO_TYPE' | translate }}</span>
                <span>{{ order()!.cargo_type }}</span>
              </div>
              <div class="info-item">
                <span class="info-key">{{ 'ORDERS.DETAIL.CARGO_DESC' | translate }}</span>
                <span>{{ order()!.cargo_description }}</span>
              </div>
              <div class="info-item">
                <span class="info-key">{{ 'ORDERS.DETAIL.CARGO_WEIGHT' | translate }}</span>
                <span>{{ order()!.weight_kg }} kg</span>
              </div>
              <div class="info-item" *ngIf="order()!.volume_m3">
                <span class="info-key">{{ 'ORDERS.DETAIL.CARGO_VOLUME' | translate }}</span>
                <span>{{ order()!.volume_m3 }} m³</span>
              </div>
              <div class="info-item" *ngIf="order()!.proposed_price">
                <span class="info-key">{{ 'ORDERS.DETAIL.CARGO_BUDGET' | translate }}</span>
                <span>{{ order()!.proposed_price | number }} XOF</span>
              </div>
              <div class="info-item" *ngIf="order()!.final_price">
                <span class="info-key">{{ 'ORDERS.DETAIL.FINAL_PRICE' | translate }}</span>
                <span><strong>{{ order()!.final_price | number }} XOF</strong></span>
              </div>
              <div class="info-item" *ngIf="order()!.suggested_price">
                <span class="info-key">{{ 'ORDERS.DETAIL.SUGGESTED_PRICE' | translate }}</span>
                <span>{{ order()!.suggested_price!.min_price_xof | number }} – {{ order()!.suggested_price!.max_price_xof | number }} XOF</span>
              </div>
              <div class="info-item" *ngIf="order()!.special_instructions">
                <span class="info-key">{{ 'ORDERS.DETAIL.CARGO_NOTES' | translate }}</span>
                <span>{{ order()!.special_instructions }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="detail-sidebar">
          <div class="card" *ngIf="order()!.assignment">
            <h3>{{ 'ORDERS.DETAIL.DRIVER_TITLE' | translate }}</h3>
            <div class="driver-card">
              <div class="driver-avatar">🧑‍✈️</div>
              <div>
                <div class="font-bold">{{ order()!.assignment!.driver_detail.full_name }}</div>
                <div class="text-muted text-sm">{{ order()!.assignment!.driver_detail.phone_number }}</div>
                <div class="text-sm mt-1" *ngIf="order()!.final_price">
                  {{ 'ORDERS.DETAIL.DRIVER_PRICE' | translate }}:
                  <strong>{{ order()!.final_price | number }} XOF</strong>
                </div>
              </div>
            </div>
            <a class="btn-action btn-blue mt-2"
              [routerLink]="['/tracking']" [queryParams]="{order: order()!.id}">
              {{ 'ORDERS.DETAIL.DRIVER_TRACK' | translate }}
            </a>
          </div>

          <!-- Proof photos (visible to both parties once submitted) -->
          <div class="card" *ngIf="order()!.assignment?.pickup_proof_photo || order()!.assignment?.proof_photo">
            <h3>{{ 'ORDERS.DETAIL.PROOF_PHOTOS_TITLE' | translate }}</h3>
            <div *ngIf="order()!.assignment?.pickup_proof_photo">
              <div class="proof-label">📦 {{ 'ORDERS.DETAIL.PICKUP_PROOF_LABEL' | translate }}</div>
              <img [src]="order()!.assignment!.pickup_proof_photo" class="proof-img" alt="Pickup proof"
                   (click)="lightboxUrl.set(order()!.assignment!.pickup_proof_photo)" />
              <div class="text-muted text-sm" *ngIf="order()!.assignment!.pickup_proof_note">
                {{ order()!.assignment!.pickup_proof_note }}
              </div>
            </div>
            <div *ngIf="order()!.assignment?.proof_photo" class="mt-2">
              <div class="proof-label">🏁 {{ 'ORDERS.DETAIL.DELIVERY_PROOF_LABEL' | translate }}</div>
              <img [src]="order()!.assignment!.proof_photo" class="proof-img" alt="Delivery proof"
                   (click)="lightboxUrl.set(order()!.assignment!.proof_photo)" />
              <div class="text-muted text-sm" *ngIf="order()!.assignment!.proof_note">
                {{ order()!.assignment!.proof_note }}
              </div>
            </div>
          </div>

          <div class="card">
            <h3>{{ 'ORDERS.DETAIL.INFO_TITLE' | translate }}</h3>
            <div class="info-list">
              <div class="info-item">
                <span class="info-key">{{ 'ORDERS.DETAIL.INFO_CREATED' | translate }}</span>
                <span>{{ order()!.created_at | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="info-item">
                <span class="info-key">{{ 'ORDERS.DETAIL.INFO_UPDATED' | translate }}</span>
                <span>{{ order()!.updated_at | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ng-template #loadingTpl>
      <div class="loading-overlay">⏳ {{ 'COMMON.LOADING' | translate }}</div>
    </ng-template>

    <!-- Lightbox modal -->
    <div class="lightbox-overlay" *ngIf="lightboxUrl()" (click)="lightboxUrl.set(null)">
      <div class="lightbox-content" (click)="$event.stopPropagation()">
        <button class="lightbox-close" (click)="lightboxUrl.set(null)">✕</button>
        <img [src]="lightboxUrl()!" class="lightbox-img" alt="Proof photo" />
      </div>
    </div>
  `,
  styles: [`
    .detail-page { max-width: 1100px; }
    .back-link { display: inline-block; color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; text-decoration: none; }
    .back-link:hover { color: #FF6B35; }
    .detail-layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; }
    .detail-main { display: flex; flex-direction: column; gap: 16px; }
    .detail-sidebar { display: flex; flex-direction: column; gap: 16px; }
    .card { background: var(--surface); border-radius: 12px; padding: 20px; box-shadow: var(--shadow); border: 1px solid var(--border); }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 8px; color: var(--text-primary); }
    h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: var(--text-primary); }
    h4 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-primary); }
    .header-actions { display: flex; gap: 8px; }
    .btn-action { padding: 9px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; }
    .btn-orange { background: #FF6B35; color: white; }
    .btn-green { background: #00C896; color: white; }
    .btn-red { background: #F44336; color: white; }
    .btn-blue { background: #2196F3; color: white; width: 100%; }
    .btn-sm { padding: 5px 10px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge--draft { background:rgba(158,158,158,0.2);color:#9E9E9E }
    .badge--posted { background:rgba(33,150,243,0.15);color:#64B5F6 }
    .badge--assigned { background:rgba(156,39,176,0.15);color:#CE93D8 }
    .badge--in_transit { background:rgba(67,160,71,0.15);color:#81C784 }
    .badge--delivered { background:rgba(0,150,136,0.15);color:#4DB6AC }
    .badge--completed { background:rgba(76,175,80,0.2);color:#A5D6A7 }
    .badge--cancelled { background:rgba(244,67,54,0.15);color:#EF9A9A }
    .route-display { display: flex; flex-direction: column; gap: 0; }
    .route-point { display: flex; gap: 16px; align-items: flex-start; padding: 12px 0; }
    .route-dot { font-size: 20px; margin-top: 2px; }
    .route-city { font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .route-address { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
    .route-date { font-size: 12px; color: #FF6B35; margin-top: 4px; font-weight: 600; }
    .route-line { width: 2px; height: 24px; background: var(--border); margin-left: 10px; }
    .info-grid, .info-list { display: flex; flex-direction: column; gap: 10px; }
    .info-item { display: flex; gap: 12px; font-size: 14px; color: var(--text-primary); }
    .info-key { color: var(--text-secondary); min-width: 100px; font-size: 13px; }
    .form-group { margin-bottom: 12px; }
    label { display: block; font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 5px; }
    input, textarea { width: 100%; padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 6px; font-size: 14px; outline: none; background: var(--surface-raised); color: var(--text-primary); font-family: inherit; }
    input:focus, textarea:focus { border-color: #FF6B35; }
    textarea { resize: vertical; }
    .driver-card { display: flex; gap: 14px; align-items: center; }
    .driver-avatar { font-size: 32px; }
    .mt-1 { margin-top: 8px; } .mt-2 { margin-top: 12px; }
    .font-bold { font-weight: 600; color: var(--text-primary); } .text-muted { color: var(--text-secondary); } .text-sm { font-size: 12px; }
    .empty-state { text-align: center; padding: 20px; color: var(--text-secondary); }
    .loading-overlay { text-align: center; padding: 48px; color: var(--text-secondary); font-size: 16px; }
    .alert-error { background: rgba(198,40,40,0.12); color: #EF9A9A; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; border: 1px solid rgba(244,67,54,0.3); }
    .proof-card { border: 2px dashed #FF6B35; }
    .proof-hint { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
    .file-input-row { display: flex; align-items: center; gap: 12px; }
    .file-btn { display: inline-block; padding: 8px 14px; background: rgba(255,107,53,0.12); color: #FF6B35; border: 1.5px solid #FF6B35; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .file-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .proof-actions { display: flex; gap: 8px; margin-top: 4px; }
    .btn-ghost { background: transparent; color: var(--text-secondary); border: 1.5px solid var(--border); padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .proof-img { width: 100%; border-radius: 8px; margin: 8px 0; cursor: pointer; }
    .proof-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.78); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .lightbox-content { position: relative; max-width: 90vw; max-height: 90vh; }
    .lightbox-close { position: absolute; top: -40px; right: 0; background: none; border: none; color: white; font-size: 26px; cursor: pointer; line-height: 1; padding: 4px 8px; }
    .lightbox-img { max-width: 90vw; max-height: 85vh; border-radius: 8px; object-fit: contain; display: block; }
    @media (max-width: 768px) { .detail-layout { grid-template-columns: 1fr; } }
  `]
})
export class OrderDetailComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  order = signal<FreightOrder | null>(null);
  lightboxUrl = signal<string | null>(null);

  // Pickup proof state
  showPickupForm = signal(false);
  pickupNote = '';
  pickupPhoto: File | null = null;
  pickupPhotoName = signal('');
  pickupSubmitting = signal(false);

  // Delivery proof state
  showDeliveryForm = signal(false);
  deliveryNote = '';
  deliveryPhoto: File | null = null;
  deliveryPhotoName = signal('');
  deliverySubmitting = signal(false);

  actionError = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getOrder(id).subscribe({
      next: (o) => this.order.set(o),
    });
  }

  canCancel(): boolean {
    const s = this.order()?.status;
    return (s === 'DRAFT' || s === 'POSTED') &&
      this.auth.hasRole('SHIPPER', 'ADMIN');
  }

  isAssignedDriver(): boolean {
    const o = this.order();
    if (!o?.assignment) return false;
    const me = this.auth.user();
    return o.assignment.driver === me?.id;
  }

  postOrder(): void {
    const id = this.order()!.id;
    this.api.postOrder(id).subscribe({
      next: () => this.api.getOrder(id).subscribe(o => this.order.set(o)),
    });
  }

  acceptOrder(): void {
    this.actionError.set('');
    this.api.acceptOrder(this.order()!.id).subscribe({
      next: () => this.api.getOrder(this.order()!.id).subscribe(o => this.order.set(o)),
      error: (err) => this.actionError.set(err?.error?.error?.message ?? 'Failed to accept order.'),
    });
  }

  cancelOrder(): void {
    if (!confirm(this.translate.instant('ORDERS.DETAIL.CANCEL_CONFIRM'))) return;
    this.api.cancelOrder(this.order()!.id).subscribe({ next: (o) => this.order.set(o) });
  }

  confirmDelivery(): void {
    this.api.confirmDelivery(this.order()!.id).subscribe({
      next: () => this.api.getOrder(this.order()!.id).subscribe(o => this.order.set(o)),
    });
  }

  revertPickup(): void {
    if (!confirm(this.translate.instant('ORDERS.DETAIL.REVERT_TO_ASSIGNED_CONFIRM'))) return;
    this.actionError.set('');
    this.api.revertPickup(this.order()!.id).subscribe({
      next: () => this.api.getOrder(this.order()!.id).subscribe(o => this.order.set(o)),
      error: (err) => this.actionError.set(err?.error?.error?.message ?? 'Failed to revert pickup.'),
    });
  }

  onPickupPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.pickupPhoto = file;
    this.pickupPhotoName.set(file?.name ?? '');
  }

  submitPickupProof(): void {
    this.pickupSubmitting.set(true);
    this.actionError.set('');
    this.api.submitPickupProof(this.order()!.id, this.pickupPhoto, this.pickupNote).subscribe({
      next: () => {
        this.pickupSubmitting.set(false);
        this.showPickupForm.set(false);
        this.pickupPhoto = null;
        this.pickupPhotoName.set('');
        this.pickupNote = '';
        this.api.getOrder(this.order()!.id).subscribe(o => this.order.set(o));
      },
      error: (err) => {
        this.actionError.set(err?.error?.error?.message ?? 'Failed to submit pickup proof.');
        this.pickupSubmitting.set(false);
      },
    });
  }

  onDeliveryPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.deliveryPhoto = file;
    this.deliveryPhotoName.set(file?.name ?? '');
  }

  submitDeliveryProof(): void {
    this.deliverySubmitting.set(true);
    this.actionError.set('');
    this.api.submitDeliveryProof(this.order()!.id, this.deliveryPhoto, this.deliveryNote).subscribe({
      next: () => {
        this.deliverySubmitting.set(false);
        this.showDeliveryForm.set(false);
        this.deliveryPhoto = null;
        this.deliveryPhotoName.set('');
        this.deliveryNote = '';
        this.api.getOrder(this.order()!.id).subscribe(o => this.order.set(o));
      },
      error: (err) => {
        this.actionError.set(err?.error?.error?.message ?? 'Failed to submit delivery proof.');
        this.deliverySubmitting.set(false);
      },
    });
  }

  /** Translates a status enum value using the ORDERS.STATUS.* keys */
  statusLabel(s: string): string {
    return this.translate.instant('ORDERS.STATUS.' + s);
  }
}
