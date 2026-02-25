import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FreightOrder } from '../../core/models/order.model';

interface StatCard { label: string; value: string | number; icon: string; color: string; }

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
        <a class="btn-action" routerLink="/orders/new" *ngIf="auth.hasRole('SHIPPER', 'BROKER', 'ADMIN')">
          {{ 'DASHBOARD.NEW_ORDER' | translate }}
        </a>
      </div>

      <div class="stats-grid">
        <div class="stat-card" *ngFor="let s of stats()">
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
          <a routerLink="/orders" class="see-all">{{ 'COMMON.SEE_ALL' | translate }}</a>
        </div>

        <div class="loading-overlay" *ngIf="loading()">⏳ {{ 'COMMON.LOADING' | translate }}</div>

        <div class="orders-list" *ngIf="!loading() && recentOrders().length">
          <div class="order-row" *ngFor="let o of recentOrders()" [routerLink]="['/orders', o.id]">
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
              {{ o.weight_kg }} kg · {{ formatDate(o.pickup_date) }}
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="!loading() && !recentOrders().length">
          <div class="empty-icon">📦</div>
          <h3>{{ 'DASHBOARD.EMPTY_TITLE' | translate }}</h3>
          <p>{{ 'DASHBOARD.EMPTY_SUBTITLE' | translate }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1100px; }
    .welcome-banner { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .btn-action { padding: 10px 20px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; transition: background .2s; }
    .btn-action:hover { background: #e55a24; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: white; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .stat-value { font-size: 24px; font-weight: 800; color: #212121; }
    .stat-label { font-size: 12px; color: #757575; margin-top: 2px; }
    .section { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    h2 { font-size: 18px; font-weight: 700; }
    .see-all { color: #FF6B35; font-size: 13px; font-weight: 600; text-decoration: none; }
    .order-row { display: flex; align-items: center; gap: 20px; padding: 14px 8px; border-bottom: 1px solid #F0F0F0; cursor: pointer; border-radius: 6px; }
    .order-row:last-child { border-bottom: none; }
    .order-row:hover { background: #FAFAFA; }
    .order-ref { display: flex; align-items: center; gap: 10px; min-width: 220px; }
    .order-route { display: flex; align-items: center; gap: 8px; flex: 1; font-size: 13px; }
    .route-arrow { color: #BDBDBD; }
    .order-meta { margin-left: auto; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge--draft{background:#E0E0E0;color:#616161}.badge--posted{background:#E3F2FD;color:#1565C0}.badge--bidding{background:#FFF3E0;color:#E65100}.badge--assigned{background:#F3E5F5;color:#6A1B9A}.badge--in_transit{background:#E8F5E9;color:#2E7D32}.badge--delivered{background:#E0F2F1;color:#00695C}.badge--completed{background:#C8E6C9;color:#1B5E20}.badge--cancelled{background:#FFEBEE;color:#B71C1C}.badge--disputed{background:#FCE4EC;color:#880E4F}.badge--pickup_pending{background:#FFF8E1;color:#F57F17}.badge--picked_up{background:#E8EAF6;color:#283593}
    .text-sm { font-size: 12px; } .text-muted { color: #757575; }
    .loading-overlay { text-align: center; padding: 40px; color: #757575; }
    .empty-state { padding: 48px; text-align: center; color: #757575; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);

  loading = signal(true);
  recentOrders = signal<FreightOrder[]>([]);

  firstName = computed(() => (this.auth.user()?.full_name || '').split(' ')[0]);

  stats = computed<StatCard[]>(() => {
    const orders = this.recentOrders();
    return [
      { label: 'DASHBOARD.STATS.TOTAL',     value: orders.length,                                              icon: '📦', color: '#FF6B35' },
      { label: 'DASHBOARD.STATS.IN_TRANSIT', value: orders.filter(o => o.status === 'IN_TRANSIT').length,      icon: '🚛', color: '#2196F3' },
      { label: 'DASHBOARD.STATS.COMPLETED',  value: orders.filter(o => o.status === 'COMPLETED').length,       icon: '✅', color: '#00C896' },
      { label: 'DASHBOARD.STATS.PENDING',    value: orders.filter(o => o.status === 'POSTED').length,          icon: '⏳', color: '#FF9800' },
    ];
  });

  ngOnInit(): void {
    this.api.getOrders({ page_size: '10' }).subscribe({
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
