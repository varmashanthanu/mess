import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { FreightOrder, OrderBid } from '../../../core/models/order.model';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TranslateModule],
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
                  *ngIf="order()!.status === 'DRAFT' && auth.hasRole('SHIPPER','BROKER','ADMIN')"
                  (click)="postOrder()">
                  {{ 'ORDERS.DETAIL.PUBLISH' | translate }}
                </button>
                <button class="btn-action btn-green"
                  *ngIf="order()!.status === 'DELIVERED' && auth.hasRole('SHIPPER')"
                  (click)="confirmDelivery()">
                  {{ 'ORDERS.DETAIL.CONFIRM_DELIVERY' | translate }}
                </button>
                <button class="btn-action btn-red"
                  *ngIf="canCancel()"
                  (click)="cancelOrder()">
                  {{ 'ORDERS.DETAIL.CANCEL_ORDER' | translate }}
                </button>
              </div>
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
                  <div class="route-date">{{ order()!.pickup_date | date:'dd/MM/yyyy' }}</div>
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
              <div class="info-item" *ngIf="order()!.budget_xof">
                <span class="info-key">{{ 'ORDERS.DETAIL.CARGO_BUDGET' | translate }}</span>
                <span>{{ order()!.budget_xof | number }} XOF</span>
              </div>
              <div class="info-item" *ngIf="order()!.notes">
                <span class="info-key">{{ 'ORDERS.DETAIL.CARGO_NOTES' | translate }}</span>
                <span>{{ order()!.notes }}</span>
              </div>
            </div>
          </div>

          <!-- Bids -->
          <div class="card" *ngIf="showBids()">
            <h3>{{ 'ORDERS.DETAIL.BIDS_TITLE' | translate }} ({{ bids().length }})</h3>

            <!-- Submit bid (driver) -->
            <div class="bid-form" *ngIf="auth.hasRole('DRIVER') && order()!.status === 'POSTED'">
              <h4>{{ 'ORDERS.DETAIL.BID_FORM_TITLE' | translate }}</h4>
              <form [formGroup]="bidForm" (ngSubmit)="submitBid()">
                <div class="form-row">
                  <div class="form-group">
                    <label>{{ 'ORDERS.DETAIL.BID_AMOUNT' | translate }}</label>
                    <input type="number" formControlName="amount_xof" placeholder="150000" />
                  </div>
                  <div class="form-group">
                    <label>{{ 'ORDERS.DETAIL.BID_DATE' | translate }}</label>
                    <input type="datetime-local" formControlName="estimated_pickup" />
                  </div>
                </div>
                <div class="form-group">
                  <label>{{ 'ORDERS.DETAIL.BID_MESSAGE' | translate }}</label>
                  <textarea formControlName="message" rows="2"
                    [placeholder]="'ORDERS.DETAIL.BID_MESSAGE_PLACEHOLDER' | translate"></textarea>
                </div>
                <button type="submit" class="btn-action btn-orange" [disabled]="bidSubmitting()">
                  {{ (bidSubmitting() ? 'ORDERS.DETAIL.BID_SUBMITTING' : 'ORDERS.DETAIL.BID_SUBMIT') | translate }}
                </button>
              </form>
            </div>

            <!-- Bids list -->
            <div class="bids-list">
              <div class="bid-item" *ngFor="let bid of bids()">
                <div class="bid-main">
                  <div>
                    <strong>{{ bid.driver_name }}</strong>
                    <span class="text-muted text-sm"> · {{ bid.driver_phone }}</span>
                  </div>
                  <div class="bid-amount">{{ bid.amount_xof | number }} XOF</div>
                </div>
                <div class="bid-message text-muted text-sm" *ngIf="bid.message">{{ bid.message }}</div>
                <div class="bid-actions"
                  *ngIf="auth.hasRole('SHIPPER','BROKER','ADMIN') && bid.status === 'PENDING'">
                  <button class="btn-sm btn-green" (click)="acceptBid(bid.id)">
                    {{ 'ORDERS.DETAIL.BID_ACCEPT' | translate }}
                  </button>
                </div>
                <span class="badge badge--{{ bid.status.toLowerCase() }}">
                  {{ statusLabel(bid.status) }}
                </span>
              </div>
              <div class="empty-state" *ngIf="!bids().length">
                {{ 'ORDERS.DETAIL.BID_EMPTY' | translate }}
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
                <div class="font-bold">{{ order()!.assignment!.driver_name }}</div>
                <div class="text-muted text-sm">{{ order()!.assignment!.driver_phone }}</div>
                <div class="text-sm mt-1">
                  {{ 'ORDERS.DETAIL.DRIVER_PRICE' | translate }}:
                  <strong>{{ order()!.assignment!.agreed_price_xof | number }} XOF</strong>
                </div>
              </div>
            </div>
            <a class="btn-action btn-blue mt-2"
              [routerLink]="['/tracking']" [queryParams]="{order: order()!.id}">
              {{ 'ORDERS.DETAIL.DRIVER_TRACK' | translate }}
            </a>
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
  `,
  styles: [`
    .detail-page { max-width: 1100px; }
    .back-link { display: inline-block; color: #757575; font-size: 13px; margin-bottom: 16px; text-decoration: none; }
    .back-link:hover { color: #FF6B35; }
    .detail-layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; }
    .detail-main { display: flex; flex-direction: column; gap: 16px; }
    .detail-sidebar { display: flex; flex-direction: column; gap: 16px; }
    .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
    h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
    h4 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .header-actions { display: flex; gap: 8px; }
    .btn-action { padding: 9px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; }
    .btn-orange { background: #FF6B35; color: white; }
    .btn-green { background: #00C896; color: white; }
    .btn-red { background: #F44336; color: white; }
    .btn-blue { background: #2196F3; color: white; width: 100%; }
    .btn-sm { padding: 5px 10px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge--draft { background:#E0E0E0;color:#616161 }
    .badge--posted { background:#E3F2FD;color:#1565C0 }
    .badge--bidding { background:#FFF3E0;color:#E65100 }
    .badge--assigned { background:#F3E5F5;color:#6A1B9A }
    .badge--in_transit { background:#E8F5E9;color:#2E7D32 }
    .badge--delivered { background:#E0F2F1;color:#00695C }
    .badge--completed { background:#C8E6C9;color:#1B5E20 }
    .badge--cancelled { background:#FFEBEE;color:#B71C1C }
    .badge--pending { background:#E3F2FD;color:#1565C0 }
    .badge--accepted { background:#C8E6C9;color:#1B5E20 }
    .badge--rejected { background:#FFEBEE;color:#B71C1C }
    .route-display { display: flex; flex-direction: column; gap: 0; }
    .route-point { display: flex; gap: 16px; align-items: flex-start; padding: 12px 0; }
    .route-dot { font-size: 20px; margin-top: 2px; }
    .route-city { font-size: 16px; font-weight: 700; }
    .route-address { font-size: 13px; color: #757575; margin-top: 2px; }
    .route-date { font-size: 12px; color: #FF6B35; margin-top: 4px; font-weight: 600; }
    .route-line { width: 2px; height: 24px; background: #E0E0E0; margin-left: 10px; }
    .info-grid, .info-list { display: flex; flex-direction: column; gap: 10px; }
    .info-item { display: flex; gap: 12px; font-size: 14px; }
    .info-key { color: #757575; min-width: 100px; font-size: 13px; }
    .bid-form { background: #F9F9F9; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-group { margin-bottom: 12px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #424242; margin-bottom: 5px; }
    input, textarea { width: 100%; padding: 9px 12px; border: 1.5px solid #E0E0E0; border-radius: 6px; font-size: 14px; outline: none; }
    input:focus, textarea:focus { border-color: #FF6B35; }
    textarea { resize: vertical; font-family: inherit; }
    .bids-list { display: flex; flex-direction: column; gap: 12px; }
    .bid-item { border: 1px solid #F0F0F0; border-radius: 8px; padding: 14px; }
    .bid-main { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .bid-amount { font-size: 16px; font-weight: 800; color: #FF6B35; }
    .bid-message { margin-bottom: 8px; }
    .bid-actions { display: flex; gap: 8px; margin-top: 8px; }
    .driver-card { display: flex; gap: 14px; align-items: center; }
    .driver-avatar { font-size: 32px; }
    .mt-1 { margin-top: 8px; } .mt-2 { margin-top: 12px; }
    .font-bold { font-weight: 600; } .text-muted { color: #757575; } .text-sm { font-size: 12px; }
    .empty-state { text-align: center; padding: 20px; color: #757575; }
    .loading-overlay { text-align: center; padding: 48px; color: #757575; font-size: 16px; }
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
  bids = signal<OrderBid[]>([]);
  bidSubmitting = signal(false);

  bidForm = this.fb.group({
    amount_xof:       [null as number | null, Validators.required],
    estimated_pickup: [''],
    message:          [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getOrder(id).subscribe({
      next: (o) => { this.order.set(o); if (this.showBids()) this.loadBids(id); },
    });
  }

  loadBids(id: string): void {
    this.api.getBids(id).subscribe({ next: (res) => this.bids.set(res.results) });
  }

  showBids(): boolean {
    const s = this.order()?.status;
    return s === 'POSTED' || s === 'BIDDING';
  }

  canCancel(): boolean {
    const s = this.order()?.status;
    return (s === 'DRAFT' || s === 'POSTED' || s === 'BIDDING') &&
      this.auth.hasRole('SHIPPER', 'BROKER', 'ADMIN');
  }

  postOrder(): void {
    this.api.postOrder(this.order()!.id).subscribe({ next: (o) => this.order.set(o) });
  }

  cancelOrder(): void {
    if (!confirm(this.translate.instant('ORDERS.DETAIL.CANCEL_CONFIRM'))) return;
    this.api.cancelOrder(this.order()!.id).subscribe({ next: (o) => this.order.set(o) });
  }

  confirmDelivery(): void {
    this.api.confirmDelivery(this.order()!.id).subscribe({ next: (o) => this.order.set(o) });
  }

  submitBid(): void {
    if (this.bidForm.invalid) return;
    this.bidSubmitting.set(true);
    const v = this.bidForm.value;
    this.api.submitBid(this.order()!.id, {
      amount_xof:       v.amount_xof!,
      message:          v.message ?? '',
      estimated_pickup: v.estimated_pickup ?? undefined,
    }).subscribe({
      next: (bid) => {
        this.bids.update(bs => [bid, ...bs]);
        this.bidSubmitting.set(false);
        this.bidForm.reset();
      },
      error: () => this.bidSubmitting.set(false),
    });
  }

  acceptBid(bidId: string): void {
    this.api.acceptBid(this.order()!.id, bidId).subscribe({
      next: () => {
        this.api.getOrder(this.order()!.id).subscribe(o => this.order.set(o));
        this.loadBids(this.order()!.id);
      },
    });
  }

  /** Translates a status enum value using the ORDERS.STATUS.* keys */
  statusLabel(s: string): string {
    return this.translate.instant('ORDERS.STATUS.' + s);
  }
}
