import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FreightOrder } from '../../core/models/order.model';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', POSTED: 'Publié', ASSIGNED: 'Assigné',
  IN_TRANSIT: 'En transit', DELIVERED: 'Livré', COMPLETED: 'Terminé', CANCELLED: 'Annulé',
};

@Component({
  selector: 'app-company-driver-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="cd-page">
      <!-- Header -->
      <div class="cd-header">
        <div class="cd-welcome">
          <div class="cd-avatar">🧑‍✈️</div>
          <div>
            <div class="cd-name">{{ auth.user()?.full_name }}</div>
            <div class="cd-company">{{ 'CD.EMPLOYER' | translate }}: {{ companyName() }}</div>
          </div>
        </div>
        <div class="cd-stats">
          <div class="cd-stat">
            <div class="cd-stat-val">{{ doneOrders().length }}</div>
            <div class="cd-stat-lbl">{{ 'CD.COMPLETED' | translate }}</div>
          </div>
          <div class="cd-stat">
            <div class="cd-stat-val">{{ activeOrders().length }}</div>
            <div class="cd-stat-lbl">{{ 'CD.ACTIVE' | translate }}</div>
          </div>
        </div>
      </div>

      <div *ngIf="loading()" class="loading">⏳ {{ 'COMMON.LOADING' | translate }}</div>

      <!-- Active job -->
      <ng-container *ngIf="!loading()">
        <div class="section-title">{{ 'CD.ACTIVE_JOB' | translate }}</div>

        <div *ngIf="!activeOrders().length" class="empty-active card">
          <div class="empty-icon">✅</div>
          <p>{{ 'CD.NO_ACTIVE_JOB' | translate }}</p>
        </div>

        <div *ngFor="let o of activeOrders()" class="active-card card" [routerLink]="['/orders', o.id]">
          <div class="active-top">
            <span class="badge badge--{{ o.status.toLowerCase() }}">{{ statusLabel(o.status) }}</span>
            <span class="ref">{{ o.reference }}</span>
          </div>
          <div class="route">
            <span class="city">{{ o.pickup_city }}</span>
            <span class="arrow">→</span>
            <span class="city">{{ o.delivery_city }}</span>
          </div>
          <div class="active-meta">
            <span>📦 {{ o.weight_kg | number }} kg</span>
            <span>📅 {{ o.pickup_scheduled_at | date:'dd/MM/yyyy' }}</span>
            <span *ngIf="o.final_price">💰 {{ o.final_price | number }} XOF</span>
          </div>
          <div class="active-actions">
            <a [routerLink]="['/orders', o.id]" class="btn-view">
              {{ o.status === 'ASSIGNED' ? ('CD.START_PICKUP' | translate) : ('CD.VIEW_JOB' | translate) }}
            </a>
          </div>
        </div>

        <!-- Recent jobs -->
        <div class="section-title mt-2">{{ 'CD.RECENT_JOBS' | translate }}</div>

        <div class="card" *ngIf="recentOrders().length">
          <table class="cd-table">
            <thead>
              <tr>
                <th>{{ 'ORDERS.COL_REF' | translate }}</th>
                <th>{{ 'CD.ROUTE' | translate }}</th>
                <th>{{ 'ORDERS.COL_DATE' | translate }}</th>
                <th>{{ 'ORDERS.COL_STATUS' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let o of recentOrders()">
                <td><strong>{{ o.reference }}</strong></td>
                <td>{{ o.pickup_city }} → {{ o.delivery_city }}</td>
                <td>{{ o.pickup_scheduled_at | date:'dd/MM/yy' }}</td>
                <td>
                  <span class="badge badge--{{ o.status.toLowerCase() }}">{{ statusLabel(o.status) }}</span>
                </td>
                <td><a [routerLink]="['/orders', o.id]" class="btn-sm">{{ 'COMMON.VIEW' | translate }}</a></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card empty-state" *ngIf="!recentOrders().length && !activeOrders().length">
          <div class="empty-icon">📭</div>
          <p>{{ 'CD.NO_JOBS_YET' | translate }}</p>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .cd-page { max-width: 860px; }

    .cd-header {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--surface); border-radius: 14px; padding: 20px 24px;
      box-shadow: var(--shadow); border: 1px solid var(--border); margin-bottom: 20px;
      flex-wrap: wrap; gap: 16px;
    }
    .cd-welcome { display: flex; align-items: center; gap: 14px; }
    .cd-avatar { font-size: 42px; }
    .cd-name { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .cd-company { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
    .cd-stats { display: flex; gap: 20px; }
    .cd-stat { text-align: center; }
    .cd-stat-val { font-size: 22px; font-weight: 800; color: var(--gold); }
    .cd-stat-lbl { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

    .section-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
    .mt-2 { margin-top: 20px; }

    .card { background: var(--surface); border-radius: 12px; padding: 18px 20px; box-shadow: var(--shadow); border: 1px solid var(--border); margin-bottom: 14px; }

    .empty-active { text-align: center; padding: 28px; color: var(--text-secondary); font-size: 14px; }
    .empty-active .empty-icon { font-size: 32px; margin-bottom: 8px; }

    .active-card { cursor: pointer; transition: border-color .15s; }
    .active-card:hover { border-color: var(--gold); }
    .active-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .ref { font-size: 13px; font-weight: 700; color: var(--text-secondary); }
    .route { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .city { font-size: 17px; font-weight: 700; color: var(--text-primary); }
    .arrow { font-size: 16px; color: var(--gold); }
    .active-meta { display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); flex-wrap: wrap; margin-bottom: 14px; }
    .active-actions { display: flex; gap: 8px; }

    .btn-view { display: inline-block; padding: 9px 18px; background: #FF6B35; color: white; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; }
    .btn-sm { padding: 4px 10px; background: rgba(255,107,53,0.12); color: #FF6B35; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; white-space: nowrap; }

    .cd-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .cd-table th { text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-secondary); border-bottom: 2px solid var(--border); }
    .cd-table td { padding: 11px 10px; border-bottom: 1px solid var(--border); color: var(--text-primary); vertical-align: middle; }
    .cd-table tr:last-child td { border-bottom: none; }

    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    .badge--assigned   { background: rgba(156,39,176,0.15); color: #CE93D8; }
    .badge--in_transit { background: rgba(33,150,243,0.15); color: #64B5F6; }
    .badge--delivered  { background: rgba(102,187,106,0.15); color: #81C784; }
    .badge--completed  { background: rgba(102,187,106,0.15); color: #81C784; }
    .badge--cancelled  { background: rgba(244,67,54,0.12); color: #EF9A9A; }
    .badge--posted     { background: rgba(255,193,7,0.15); color: #FFD54F; }

    .empty-state { text-align: center; padding: 40px; color: var(--text-secondary); }
    .empty-icon { font-size: 36px; margin-bottom: 10px; }
    .loading { text-align: center; padding: 40px; color: var(--text-secondary); }

    @media (max-width: 600px) {
      .cd-header { flex-direction: column; align-items: flex-start; }
      .cd-stats { width: 100%; justify-content: space-around; }
      .active-meta { flex-direction: column; gap: 6px; }
    }
  `],
})
export class CompanyDriverDashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);

  loading = signal(true);
  orders  = signal<FreightOrder[]>([]);

  activeStatuses = ['ASSIGNED', 'IN_TRANSIT'];

  activeOrders = computed(() => this.orders().filter(o => this.activeStatuses.includes(o.status)));
  doneOrders   = computed(() => this.orders().filter(o => o.status === 'COMPLETED'));
  recentOrders = computed(() =>
    this.orders()
      .filter(o => !this.activeStatuses.includes(o.status))
      .sort((a, b) => new Date(b.pickup_scheduled_at).getTime() - new Date(a.pickup_scheduled_at).getTime())
      .slice(0, 10)
  );

  companyName = computed(() => {
    const u = this.auth.user() as any;
    return u?.driver_profile?.employer_name ?? u?.driver_profile?.company_code ?? '—';
  });

  ngOnInit(): void {
    this.api.getOrders({ page_size: '50' }).subscribe({
      next: (res) => { this.orders.set(res.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  statusLabel(s: string): string { return STATUS_LABELS[s] ?? s; }
}
