import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { FreightOrder } from '../../../core/models/order.model';

@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslateModule],
  template: `
    <div class="orders-page">
      <div class="page-header">
        <h1>{{ 'ORDERS.TITLE' | translate }}</h1>
        <a class="btn-primary" routerLink="/orders/new"
           *ngIf="auth.hasRole('SHIPPER','BROKER','ADMIN')">{{ 'ORDERS.NEW' | translate }}</a>
      </div>

      <div class="filters card mb-2">
        <select [(ngModel)]="statusFilter" (change)="load()">
          <option value="">{{ 'ORDERS.FILTER_STATUS' | translate }}</option>
          <option *ngFor="let s of statuses" [value]="s.value">{{ 'ORDERS.STATUS.' + s.value | translate }}</option>
        </select>
        <input type="text" [(ngModel)]="search" [placeholder]="'COMMON.SEARCH' | translate" (input)="load()" />
      </div>

      <div class="loading-overlay" *ngIf="loading()">⏳ {{ 'COMMON.LOADING' | translate }}</div>

      <div class="card" *ngIf="!loading()">
        <div class="empty-state" *ngIf="!orders().length">
          <div class="empty-icon">📦</div>
          <h3>{{ 'ORDERS.EMPTY_TITLE' | translate }}</h3>
        </div>

        <table class="mess-table" *ngIf="orders().length">
          <thead>
            <tr>
              <th>{{ 'ORDERS.COL_REF' | translate }}</th>
              <th>{{ 'ORDERS.COL_ROUTE' | translate }}</th>
              <th>{{ 'ORDERS.COL_STATUS' | translate }}</th>
              <th>{{ 'ORDERS.COL_WEIGHT' | translate }}</th>
              <th>{{ 'ORDERS.COL_DATE' | translate }}</th>
              <th>{{ 'ORDERS.COL_BUDGET' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of orders()" [routerLink]="['/orders', o.id]" style="cursor:pointer">
              <td><strong>{{ o.reference }}</strong></td>
              <td>
                <div style="font-size:13px">{{ o.pickup_city }} → {{ o.delivery_city }}</div>
                <div style="font-size:11px;color:#757575">{{ o.pickup_address | slice:0:40 }}...</div>
              </td>
              <td><span class="badge badge--{{ o.status.toLowerCase() }}">{{ 'ORDERS.STATUS.' + o.status | translate }}</span></td>
              <td>{{ o.weight_kg }} kg</td>
              <td>{{ o.pickup_date | date:'dd/MM/yy' }}</td>
              <td>{{ o.budget_xof ? (o.budget_xof | number) + ' XOF' : '—' }}</td>
              <td><a [routerLink]="['/orders', o.id]" class="btn-sm">{{ 'COMMON.VIEW' | translate }}</a></td>
            </tr>
          </tbody>
        </table>

        <div class="pagination" *ngIf="totalCount() > pageSize">
          <button [disabled]="page === 1" (click)="changePage(-1)">{{ 'ORDERS.PREV' | translate }}</button>
          <span>{{ 'ORDERS.PAGE_OF' | translate: { page: page, total: totalCount() } }}</span>
          <button [disabled]="!hasNext()" (click)="changePage(1)">{{ 'ORDERS.NEXT' | translate }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .orders-page { max-width: 1100px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; }
    .btn-primary { padding: 10px 18px; background: #FF6B35; color: white; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
    .filters { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; padding: 16px; }
    select, input { padding: 9px 12px; border: 1.5px solid #E0E0E0; border-radius: 8px; font-size: 14px; outline: none; }
    input { flex: 1; }
    .mess-table { width: 100%; border-collapse: collapse; }
    .mess-table th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #757575; border-bottom: 2px solid #F0F0F0; background: #FAFAFA; }
    .mess-table td { padding: 14px 16px; border-bottom: 1px solid #F0F0F0; }
    .mess-table tr:hover td { background: #FAFAFA; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge--draft{background:#E0E0E0;color:#616161}.badge--posted{background:#E3F2FD;color:#1565C0}.badge--bidding{background:#FFF3E0;color:#E65100}.badge--assigned{background:#F3E5F5;color:#6A1B9A}.badge--in_transit{background:#E8F5E9;color:#2E7D32}.badge--delivered{background:#E0F2F1;color:#00695C}.badge--completed{background:#C8E6C9;color:#1B5E20}.badge--cancelled{background:#FFEBEE;color:#B71C1C}.badge--disputed{background:#FCE4EC;color:#880E4F}.badge--pickup_pending{background:#FFF8E1;color:#F57F17}.badge--picked_up{background:#E8EAF6;color:#283593}
    .btn-sm { padding: 5px 12px; background: #F5F5F5; color: #424242; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; }
    .pagination { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-top: 1px solid #F0F0F0; font-size: 13px; color: #757575; }
    .pagination button { padding: 8px 14px; border: 1px solid #E0E0E0; background: white; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .mb-2 { margin-bottom: 16px; }
    .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .empty-state { padding: 48px; text-align: center; color: #757575; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; }
    .loading-overlay { text-align: center; padding: 40px; color: #757575; }
  `]
})
export class OrdersListComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);

  loading = signal(true);
  orders = signal<FreightOrder[]>([]);
  totalCount = signal(0);
  page = 1;
  pageSize = 20;
  statusFilter = '';
  search = '';

  statuses = [
    { value: 'DRAFT' }, { value: 'POSTED' }, { value: 'BIDDING' }, { value: 'ASSIGNED' },
    { value: 'IN_TRANSIT' }, { value: 'DELIVERED' }, { value: 'COMPLETED' }, { value: 'CANCELLED' },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string> = { page: String(this.page), page_size: String(this.pageSize) };
    if (this.statusFilter) params['status'] = this.statusFilter;
    if (this.search) params['search'] = this.search;
    this.api.getOrders(params).subscribe({
      next: (res) => { this.orders.set(res.results); this.totalCount.set(res.count); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  changePage(dir: number): void { this.page += dir; this.load(); }
  hasNext(): boolean { return this.page * this.pageSize < this.totalCount(); }
}
