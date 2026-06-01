import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FreightOrder } from '../../core/models/order.model';

type StatFilter = 'available' | 'in_transit' | 'delivered' | 'completed' | null;
interface StatCard { label: string; value: string | number; icon: string; color: string; filter: StatFilter; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="dashboard">
      <div class="welcome-banner">
        <div>
          <h1>{{ 'DASHBOARD.GREETING' | translate: { name: firstName() } }}</h1>
          <p class="text-muted">{{ today() }}</p>
        </div>
        <a class="btn-action" routerLink="/orders/new" *ngIf="auth.hasRole('SHIPPER', 'ADMIN')">
          {{ 'DASHBOARD.NEW_ORDER' | translate }}
        </a>
      </div>

      <div class="stats-grid">
        <div class="stat-card" *ngFor="let s of stats()"
             [class.stat-card--active]="activeFilter() === s.filter"
             (click)="setFilter(s.filter)" style="cursor:pointer">
          <div class="stat-icon" [style.background]="s.color + '20'" [style.color]="s.color">{{ s.icon }}</div>
          <div class="stat-body">
            <div class="stat-value">{{ s.value }}</div>
            <div class="stat-label">{{ s.label | translate }}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2>{{ 'DASHBOARD.RECENT_ORDERS' | translate }}</h2>
          <div class="section-header-right">
            <span class="filter-badge" *ngIf="activeFilter()" (click)="setFilter(null)">
              {{ 'DASHBOARD.STATS.' + activeFilter()!.toUpperCase() | translate }} ✕
            </span>
            <a routerLink="/orders" class="see-all">{{ 'COMMON.SEE_ALL' | translate }}</a>
          </div>
        </div>

        <div class="loading-overlay" *ngIf="loading()">⏳ {{ 'COMMON.LOADING' | translate }}</div>

        <div class="orders-list" *ngIf="!loading() && filteredOrders().length">
          <div class="order-row" *ngFor="let o of filteredOrders()" [routerLink]="['/orders', o.id]">
            <div class="order-ref">
              <strong>{{ o.reference }}</strong>
              <span class="badge badge--{{ o.status.toLowerCase() }}">{{ 'ORDERS.STATUS.' + o.status | translate }}</span>
            </div>
            <div class="order-route">
              <span>📍 {{ o.pickup_city }}</span>
              <span class="route-arrow">→</span>
              <span>🏁 {{ o.delivery_city }}</span>
            </div>
            <div class="order-meta text-muted text-sm">
              {{ o.weight_kg }} kg · {{ formatDate(o.pickup_scheduled_at) }}
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="!loading() && !filteredOrders().length">
          <div class="empty-icon">📦</div>
          <h3>{{ 'DASHBOARD.EMPTY_TITLE' | translate }}</h3>
          <p>{{ 'DASHBOARD.EMPTY_SUBTITLE' | translate }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1100px; }
    .welcome-banner { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .btn-action { padding: 10px 20px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; transition: background .2s; white-space: nowrap; }
    .btn-action:hover { background: #e55a24; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: white; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: box-shadow .15s, transform .15s; }
    .stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-1px); }
    .stat-card--active { box-shadow: 0 0 0 2px #FF6B35, 0 4px 16px rgba(0,0,0,0.1); }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .stat-value { font-size: 24px; font-weight: 800; color: #212121; }
    .stat-label { font-size: 12px; color: #757575; margin-top: 2px; }
    .section { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 8px; flex-wrap: wrap; }
    .section-header-right { display: flex; align-items: center; gap: 12px; }
    .filter-badge { background: #FF6B3520; color: #FF6B35; border: 1px solid #FF6B35; border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
    h2 { font-size: 18px; font-weight: 700; }
    .see-all { color: #FF6B35; font-size: 13px; font-weight: 600; text-decoration: none; white-space: nowrap; }
    .order-row { display: flex; align-items: center; gap: 12px; padding: 14px 8px; border-bottom: 1px solid #F0F0F0; cursor: pointer; border-radius: 6px; flex-wrap: wrap; }
    .order-row:last-child { border-bottom: none; }
    .order-row:hover { background: #FAFAFA; }
    .order-ref { display: flex; align-items: center; gap: 10px; min-width: 160px; flex: 1; }
    .order-route { display: flex; align-items: center; gap: 8px; flex: 1; font-size: 13px; min-width: 140px; }
    .route-arrow { color: #BDBDBD; }
    .order-meta { margin-left: auto; white-space: nowrap; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge--draft{background:#E0E0E0;color:#616161}.badge--posted{background:#E3F2FD;color:#1565C0}.badge--assigned{background:#F3E5F5;color:#6A1B9A}.badge--in_transit{background:#E8F5E9;color:#2E7D32}.badge--delivered{background:#E0F2F1;color:#00695C}.badge--completed{background:#C8E6C9;color:#1B5E20}.badge--cancelled{background:#FFEBEE;color:#B71C1C}.badge--disputed{background:#FCE4EC;color:#880E4F}.badge--pickup_pending{background:#FFF8E1;color:#F57F17}.badge--picked_up{background:#E8EAF6;color:#283593}
    .text-sm { font-size: 12px; } .text-muted { color: #757575; }
    .loading-overlay { text-align: center; padding: 40px; color: #757575; }
    .empty-state { padding: 48px; text-align: center; color: #757575; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    @media (max-width: 600px) {
      h1 { font-size: 20px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .stat-card { padding: 14px; gap: 10px; }
      .stat-value { font-size: 20px; }
      .section { padding: 16px; }
      .order-meta { display: none; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);

  loading = signal(true);
  recentOrders = signal<FreightOrder[]>([]);
  activeFilter = signal<StatFilter>(null);

  firstName = computed(() => (this.auth.user()?.full_name || '').split(' ')[0]);

  private inTransitStatuses = ['ASSIGNED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT'];

  stats = computed<StatCard[]>(() => {
    const orders = this.recentOrders();
    return [
      { label: 'DASHBOARD.STATS.AVAILABLE',  value: orders.filter(o => o.status === 'POSTED').length,                              icon: '📦', color: '#FF6B35', filter: 'available' },
      { label: 'DASHBOARD.STATS.IN_TRANSIT', value: orders.filter(o => this.inTransitStatuses.includes(o.status)).length,          icon: '🚛', color: '#2196F3', filter: 'in_transit' },
      { label: 'DASHBOARD.STATS.DELIVERED',  value: orders.filter(o => o.status === 'DELIVERED').length,                           icon: '📬', color: '#00C896', filter: 'delivered' },
      { label: 'DASHBOARD.STATS.COMPLETED',  value: orders.filter(o => o.status === 'COMPLETED').length,                           icon: '✅', color: '#FF9800', filter: 'completed' },
    ];
  });

  filteredOrders = computed<FreightOrder[]>(() => {
    const orders = this.recentOrders();
    const filter = this.activeFilter();
    if (!filter) return orders;
    switch (filter) {
      case 'available':   return orders.filter(o => o.status === 'POSTED');
      case 'in_transit':  return orders.filter(o => this.inTransitStatuses.includes(o.status));
      case 'delivered':   return orders.filter(o => o.status === 'DELIVERED');
      case 'completed':   return orders.filter(o => o.status === 'COMPLETED');
      default:            return orders;
    }
  });

  setFilter(filter: StatFilter): void {
    this.activeFilter.set(this.activeFilter() === filter ? null : filter);
  }

  ngOnInit(): void {
    this.api.getOrders({ page_size: '100' }).subscribe({
      next: (res) => { this.recentOrders.set(res.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  today(): string {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }
}
