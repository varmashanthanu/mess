import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FreightOrder } from '../../core/models/order.model';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-broker-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="broker-page">

      <!-- ══ HERO ══ -->
      <div class="hero-banner">
        <div class="hero-left">
          <div class="hero-label">{{ 'BROKER.WORKSPACE' | translate }}</div>
          <div class="hero-greeting">{{ 'BROKER.GREETING' | translate: { name: brokerName() } }}</div>
          <div class="hero-status">
            <span class="status-dot status-dot--ok"></span>
            <span class="status-text">{{ 'BROKER.MARKETPLACE_ACTIVE' | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ loadsAwaitingMatch() }} {{ 'BROKER.SNAP_LOADS' | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ availableCarriers() }} {{ 'BROKER.SNAP_CARRIERS' | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ activeNegotiations() }} {{ 'BROKER.SNAP_NEGOTS' | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ commissionMonth() | number:'1.0-0' }} CFA {{ 'BROKER.SNAP_COMMISSION' | translate }}</span>
          </div>
        </div>
        <div class="hero-right">
          <a class="btn-match" routerLink="/load-board">🔍 {{ 'BROKER.MATCH_LOADS' | translate }}</a>
          <a class="btn-capacity" routerLink="/load-board">⚡ {{ 'BROKER.FIND_CAPACITY' | translate }}</a>
        </div>
      </div>

      <!-- ══ KPI CARDS ══ -->
      <div class="kpi-grid">
        <div class="kpi-card kpi-card--blue">
          <div class="kpi-icon">📦</div>
          <div class="kpi-val">{{ loadsAwaitingMatch() }}</div>
          <div class="kpi-lbl">{{ 'BROKER.KPI_LOADS' | translate }}</div>
          <a routerLink="/load-board" class="kpi-link">{{ 'BROKER.VIEW_ALL' | translate }} →</a>
        </div>
        <div class="kpi-card kpi-card--gold">
          <div class="kpi-icon">🚛</div>
          <div class="kpi-val">{{ availableCarriers() }}</div>
          <div class="kpi-lbl">{{ 'BROKER.KPI_CARRIERS' | translate }}</div>
          <div class="kpi-trend kpi-trend--ok">✓ {{ 'BROKER.AVAILABLE' | translate }}</div>
        </div>
        <div class="kpi-card kpi-card--green">
          <div class="kpi-icon">🟢</div>
          <div class="kpi-val">{{ activeNegotiations() }}</div>
          <div class="kpi-lbl">{{ 'BROKER.KPI_NEGOTS' | translate }}</div>
          <div class="kpi-trend kpi-trend--ok">{{ inProgress() }} {{ 'BROKER.IN_PROGRESS' | translate }}</div>
        </div>
        <div class="kpi-card kpi-card--amber">
          <div class="kpi-icon">💰</div>
          <div class="kpi-val">{{ commissionMonth() | number:'1.0-0' }}</div>
          <div class="kpi-lbl">{{ 'BROKER.KPI_COMMISSION' | translate }} (CFA)</div>
          <div class="kpi-trend kpi-trend--ok">↑ {{ 'BROKER.THIS_MONTH' | translate }}</div>
        </div>
      </div>

      <div class="two-col">

        <!-- ══ ATTENTION CENTER ══ -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title alert-amber">⚠ {{ 'BROKER.ATTENTION' | translate }}</span>
            <span class="alert-count" *ngIf="totalAlerts() > 0">{{ totalAlerts() }}</span>
          </div>

          <div class="alert-empty" *ngIf="totalAlerts() === 0">
            ✓ {{ 'BROKER.NO_ALERTS' | translate }}
          </div>

          <div *ngIf="matchingAlerts().length > 0">
            <div class="alert-section">📦 {{ 'BROKER.MATCHING_ALERTS' | translate }}</div>
            <div class="alert-item alert-item--red" *ngFor="let a of matchingAlerts()">
              <span class="alert-dot"></span>
              <span class="alert-text">{{ a }}</span>
              <button class="alert-cta">{{ 'BROKER.MATCH' | translate }}</button>
            </div>
          </div>

          <div *ngIf="negotiationAlerts().length > 0">
            <div class="alert-section">🤝 {{ 'BROKER.NEGOT_ALERTS' | translate }}</div>
            <div class="alert-item alert-item--amber" *ngFor="let a of negotiationAlerts()">
              <span class="alert-dot alert-dot--amber"></span>
              <span class="alert-text">{{ a }}</span>
              <button class="alert-cta">{{ 'BROKER.RESPOND' | translate }}</button>
            </div>
          </div>

          <div *ngIf="customerAlerts().length > 0">
            <div class="alert-section">👤 {{ 'BROKER.CUSTOMER_ALERTS' | translate }}</div>
            <div class="alert-item alert-item--blue" *ngFor="let a of customerAlerts()">
              <span class="alert-dot alert-dot--blue"></span>
              <span class="alert-text">{{ a }}</span>
              <button class="alert-cta">{{ 'BROKER.VIEW' | translate }}</button>
            </div>
          </div>
        </div>

        <!-- ══ MATCHING CENTER ══ -->
        <div class="panel matching-panel">
          <div class="panel-header">
            <span class="panel-title">🔍 {{ 'BROKER.MATCHING_CENTER' | translate }}</span>
            <a routerLink="/load-board" class="see-all">{{ 'BROKER.MATCH_NOW' | translate }} →</a>
          </div>

          <div class="match-col-title">{{ 'BROKER.LOADS_NEEDING_CAPACITY' | translate }}</div>
          <div class="match-list" *ngIf="postedLoads().length > 0">
            <div class="match-item" *ngFor="let load of postedLoads().slice(0,3)">
              <div class="match-route">
                <span class="match-origin">{{ load.pickup_city || 'Dakar' }}</span>
                <span class="match-arrow">→</span>
                <span class="match-dest">{{ load.delivery_city || 'Thiès' }}</span>
              </div>
              <div class="match-meta">
                <span class="match-price">{{ (load.proposed_price || 0) | number:'1.0-0' }} CFA</span>
                <span class="match-carriers">{{ availableCarriers() }} {{ 'BROKER.CARRIERS_AVAIL' | translate }}</span>
              </div>
              <a [routerLink]="['/orders', load.id]" class="match-btn">{{ 'BROKER.MATCH' | translate }}</a>
            </div>
          </div>
          <div class="match-empty" *ngIf="postedLoads().length === 0">
            {{ 'BROKER.NO_LOADS' | translate }}
          </div>

          <div class="match-divider"></div>

          <div class="match-col-title">{{ 'BROKER.CAPACITY_REQUIRING_LOADS' | translate }}</div>
          <div class="capacity-item" *ngIf="availableCarriers() > 0">
            <span class="cap-icon">🚛</span>
            <div class="cap-info">
              <div class="cap-name">{{ availableCarriers() }} {{ 'BROKER.TRUCKS_AVAILABLE' | translate }}</div>
              <div class="cap-sub">Dakar · {{ 'BROKER.READY_NOW' | translate }}</div>
            </div>
            <div class="ai-badge">AI 97%</div>
          </div>
          <div class="capacity-item" *ngIf="availableCarriers() === 0">
            <span class="cap-empty">{{ 'BROKER.NO_CAPACITY' | translate }}</span>
          </div>
        </div>

      </div>

      <!-- ══ DEAL PIPELINE ══ -->
      <div class="panel pipeline-panel">
        <div class="panel-header">
          <span class="panel-title">📋 {{ 'BROKER.PIPELINE' | translate }}</span>
        </div>
        <div class="pipeline-track">
          <div class="pipeline-stage" *ngFor="let stage of pipelineStages(); let last = last">
            <div class="stage-box" [class.stage-box--active]="stage.count > 0">
              <div class="stage-val">{{ stage.count }}</div>
              <div class="stage-lbl">{{ stage.label | translate }}</div>
            </div>
            <div class="stage-arrow" *ngIf="!last">↓</div>
          </div>
        </div>
      </div>

      <div class="two-col">

        <!-- ══ COMMISSION ══ -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">💰 {{ 'BROKER.COMMISSION_DASH' | translate }}</span>
          </div>
          <div class="comm-rows">
            <div class="comm-row">
              <span class="comm-period">{{ 'BROKER.COMM_TODAY' | translate }}</span>
              <span class="comm-val">{{ commissionToday() | number:'1.0-0' }} CFA</span>
            </div>
            <div class="comm-row">
              <span class="comm-period">{{ 'BROKER.COMM_WEEK' | translate }}</span>
              <span class="comm-val">{{ commissionWeek() | number:'1.0-0' }} CFA</span>
            </div>
            <div class="comm-row comm-row--highlight">
              <span class="comm-period">{{ 'BROKER.COMM_MONTH' | translate }}</span>
              <span class="comm-val comm-val--gold">{{ commissionMonth() | number:'1.0-0' }} CFA</span>
            </div>
          </div>
          <div class="comm-divider"></div>
          <div class="top-deals-title">{{ 'BROKER.TOP_DEALS' | translate }}</div>
          <div class="top-deal" *ngFor="let deal of topDeals()">
            <span class="deal-ref">{{ deal.reference }}</span>
            <span class="deal-route">{{ deal.route }}</span>
            <span class="deal-comm">+{{ deal.commission | number:'1.0-0' }} CFA</span>
          </div>
          <div class="comm-empty" *ngIf="topDeals().length === 0">{{ 'BROKER.NO_DEALS' | translate }}</div>
        </div>

        <!-- ══ PERFORMANCE ══ -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">📊 {{ 'BROKER.PERFORMANCE' | translate }}</span>
          </div>
          <div class="perf-grid">
            <div class="perf-item">
              <div class="perf-val perf-val--green">{{ matchRate() }}%</div>
              <div class="perf-lbl">{{ 'BROKER.MATCH_RATE' | translate }}</div>
            </div>
            <div class="perf-item">
              <div class="perf-val perf-val--blue">{{ avgTimeToMatch() }}m</div>
              <div class="perf-lbl">{{ 'BROKER.AVG_MATCH_TIME' | translate }}</div>
            </div>
            <div class="perf-item">
              <div class="perf-val perf-val--gold">{{ commissionMonth() | number:'1.0-0' }}</div>
              <div class="perf-lbl">{{ 'BROKER.COMMISSION_EARNED' | translate }} CFA</div>
            </div>
            <div class="perf-item">
              <div class="perf-val perf-val--amber">4.9 ⭐</div>
              <div class="perf-lbl">{{ 'BROKER.SATISFACTION' | translate }}</div>
            </div>
          </div>

          <div class="panel-header" style="margin-top:20px">
            <span class="panel-title">🕐 {{ 'BROKER.RECENT_ACTIVITY' | translate }}</span>
          </div>
          <div class="activity-list">
            <div class="activity-item" *ngFor="let a of recentActivity()">
              <span class="activity-time">{{ a.time }}</span>
              <span class="activity-dot" [class.activity-dot--green]="a.type==='success'" [class.activity-dot--amber]="a.type==='info'" [class.activity-dot--red]="a.type==='alert'"></span>
              <span class="activity-text">{{ a.text }}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  `,
  styles: [`
    .broker-page { max-width: 1200px; }

    /* Hero */
    .hero-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 20px;
      background: linear-gradient(135deg, #0A1628 0%, #0D2137 50%, #0A2B1E 100%);
      border-radius: 16px; padding: 24px 28px; margin-bottom: 20px;
      border: 1px solid rgba(102,187,106,0.2); box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .hero-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #66BB6A; margin-bottom: 6px; }
    .hero-greeting { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 10px; }
    .hero-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-dot--ok { background: #66BB6A; box-shadow: 0 0 6px #66BB6A; }
    .status-text { font-size: 13px; font-weight: 700; color: #66BB6A; }
    .status-sep { color: rgba(255,255,255,0.3); font-size: 12px; }
    .status-snap { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 500; }
    .hero-right { display: flex; flex-direction: column; gap: 10px; }
    .btn-match {
      padding: 11px 20px; background: linear-gradient(135deg, #66BB6A, #388E3C);
      color: #fff; border-radius: 10px; text-decoration: none; font-size: 13px;
      font-weight: 800; white-space: nowrap; box-shadow: 0 4px 12px rgba(102,187,106,0.35);
      transition: all .15s; text-align: center;
    }
    .btn-capacity {
      padding: 11px 20px; background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; border-radius: 10px; text-decoration: none; font-size: 13px;
      font-weight: 800; white-space: nowrap; box-shadow: 0 4px 12px rgba(201,162,39,0.35);
      transition: all .15s; text-align: center;
    }
    .btn-match:hover, .btn-capacity:hover { filter: brightness(1.1); }

    /* KPI */
    .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 20px; }
    .kpi-card {
      background: var(--surface); border-radius: 14px; padding: 20px 18px;
      border: 1px solid var(--border); box-shadow: var(--shadow);
      display: flex; flex-direction: column; gap: 4px;
    }
    .kpi-card--blue  { border-top: 3px solid #42A5F5; }
    .kpi-card--gold  { border-top: 3px solid #C9A227; }
    .kpi-card--green { border-top: 3px solid #66BB6A; }
    .kpi-card--amber { border-top: 3px solid #FFB300; }
    .kpi-icon { font-size: 22px; margin-bottom: 4px; }
    .kpi-val  { font-size: 28px; font-weight: 800; color: var(--text-primary); line-height: 1; }
    .kpi-lbl  { font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-top: 2px; }
    .kpi-trend { font-size: 11px; font-weight: 700; margin-top: 6px; }
    .kpi-trend--ok { color: #66BB6A; }
    .kpi-link { font-size: 11px; color: var(--gold); text-decoration: none; margin-top: 6px; font-weight: 700; }

    /* Two-col */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    /* Panel */
    .panel {
      background: var(--surface); border-radius: 14px; padding: 20px;
      border: 1px solid var(--border); box-shadow: var(--shadow); margin-bottom: 16px;
    }
    .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .panel-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .alert-amber { color: #FFB300; }
    .see-all { font-size: 12px; color: var(--gold); text-decoration: none; font-weight: 600; }
    .alert-count {
      background: #FFB300; color: #111; font-size: 11px; font-weight: 800;
      border-radius: 10px; padding: 2px 7px;
    }

    /* Alerts */
    .alert-empty { font-size: 13px; color: #66BB6A; padding: 8px 0; }
    .alert-section { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-secondary); margin: 12px 0 8px; }
    .alert-section:first-child { margin-top: 0; }
    .alert-item { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 8px; margin-bottom: 6px; }
    .alert-item--red  { background: rgba(229,57,53,0.08); border: 1px solid rgba(229,57,53,0.2); }
    .alert-item--amber { background: rgba(255,179,0,0.08); border: 1px solid rgba(255,179,0,0.2); }
    .alert-item--blue  { background: rgba(66,165,245,0.08); border: 1px solid rgba(66,165,245,0.2); }
    .alert-dot { width: 7px; height: 7px; border-radius: 50%; background: #E53935; flex-shrink: 0; }
    .alert-dot--amber { background: #FFB300; }
    .alert-dot--blue  { background: #42A5F5; }
    .alert-text { flex: 1; font-size: 12px; color: var(--text-primary); font-weight: 500; }
    .alert-cta {
      font-size: 11px; font-weight: 700; color: #66BB6A; background: none;
      border: 1px solid rgba(102,187,106,0.4); border-radius: 6px; padding: 3px 8px; cursor: pointer;
    }

    /* Matching center */
    .match-col-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; color: var(--text-secondary); margin-bottom: 10px; }
    .match-list { display: flex; flex-direction: column; gap: 8px; }
    .match-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-raised); flex-wrap: wrap; }
    .match-route { display: flex; align-items: center; gap: 6px; flex: 1; }
    .match-origin { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .match-arrow { color: var(--text-secondary); font-size: 12px; }
    .match-dest { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .match-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .match-price { font-size: 13px; font-weight: 800; color: var(--gold); }
    .match-carriers { font-size: 11px; color: #66BB6A; font-weight: 600; }
    .match-btn { font-size: 11px; font-weight: 700; color: #fff; background: #66BB6A; border: none; border-radius: 7px; padding: 5px 12px; cursor: pointer; text-decoration: none; }
    .match-empty { font-size: 12px; color: var(--text-secondary); padding: 8px 0; }
    .match-divider { border: none; border-top: 1px solid var(--border); margin: 14px 0; }
    .capacity-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-raised); }
    .cap-icon { font-size: 22px; }
    .cap-info { flex: 1; }
    .cap-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .cap-sub  { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .cap-empty { font-size: 12px; color: var(--text-secondary); }
    .ai-badge { font-size: 11px; font-weight: 800; color: #66BB6A; background: rgba(102,187,106,0.1); border: 1px solid rgba(102,187,106,0.3); border-radius: 8px; padding: 3px 8px; }

    /* Pipeline */
    .pipeline-panel { margin-bottom: 16px; }
    .pipeline-track { display: flex; align-items: flex-start; justify-content: center; gap: 0; }
    .pipeline-stage { display: flex; flex-direction: column; align-items: center; flex: 1; }
    .stage-box { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 10px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-raised); width: 100%; text-align: center; }
    .stage-box--active { border-color: rgba(102,187,106,0.4); background: rgba(102,187,106,0.06); }
    .stage-val { font-size: 24px; font-weight: 800; color: var(--text-primary); }
    .stage-box--active .stage-val { color: #66BB6A; }
    .stage-lbl { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; }
    .stage-arrow { font-size: 18px; color: var(--text-secondary); margin: 6px 8px; align-self: center; }

    /* Commission */
    .comm-rows { display: flex; flex-direction: column; }
    .comm-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 0; border-bottom: 1px solid var(--border); }
    .comm-row:last-child { border-bottom: none; }
    .comm-row--highlight { padding-top: 13px; }
    .comm-period { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
    .comm-val { font-size: 15px; font-weight: 800; color: var(--text-primary); }
    .comm-val--gold { color: var(--gold); }
    .comm-divider { border: none; border-top: 2px solid var(--border); margin: 14px 0 10px; }
    .top-deals-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; color: var(--text-secondary); margin-bottom: 10px; }
    .top-deal { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
    .top-deal:last-child { border-bottom: none; }
    .deal-ref { font-weight: 700; color: var(--text-primary); min-width: 60px; }
    .deal-route { flex: 1; color: var(--text-secondary); }
    .deal-comm { font-weight: 800; color: #66BB6A; }
    .comm-empty { font-size: 12px; color: var(--text-secondary); padding: 8px 0; }

    /* Performance */
    .perf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .perf-item { text-align: center; padding: 14px; border-radius: 10px; background: var(--surface-raised); border: 1px solid var(--border); }
    .perf-val { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .perf-val--green { color: #66BB6A; }
    .perf-val--blue  { color: #42A5F5; }
    .perf-val--gold  { color: #C9A227; }
    .perf-val--amber { color: #FFB300; }
    .perf-lbl { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }

    /* Activity */
    .activity-list { display: flex; flex-direction: column; gap: 10px; }
    .activity-item { display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .activity-time { font-size: 11px; color: var(--text-secondary); min-width: 40px; font-weight: 600; }
    .activity-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--border); }
    .activity-dot--green { background: #66BB6A; }
    .activity-dot--amber { background: #FFB300; }
    .activity-dot--red   { background: #E53935; }
    .activity-text { color: var(--text-primary); font-weight: 500; }

    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: repeat(2,1fr); }
      .two-col  { grid-template-columns: 1fr; }
      .pipeline-track { flex-direction: column; align-items: stretch; }
      .stage-arrow { transform: rotate(90deg); align-self: center; }
    }
    @media (max-width: 600px) {
      .hero-banner { flex-direction: column; align-items: flex-start; }
      .hero-right { flex-direction: row; width: 100%; }
      .hero-status { flex-direction: column; align-items: flex-start; gap: 4px; }
      .status-sep { display: none; }
    }
  `]
})
export class BrokerDashboardComponent implements OnInit {
  private api  = inject(ApiService);
  auth = inject(AuthService);

  allOrders = signal<FreightOrder[]>([]);
  allUsers  = signal<User[]>([]);

  ngOnInit(): void {
    this.api.getOrders({ page_size: '200', page: '1' }).subscribe({
      next: res => this.allOrders.set(res.results),
      error: () => {},
    });
    this.api.getUsers({ page_size: '100', page: '1' }).subscribe({
      next: res => this.allUsers.set((res as any).results ?? res),
      error: () => {},
    });
  }

  brokerName = computed(() => this.auth.user()?.full_name?.split(' ')[0] ?? 'Broker');

  postedLoads       = computed(() => this.allOrders().filter(o => o.status === 'POSTED'));
  loadsAwaitingMatch = computed(() => this.postedLoads().length);
  availableCarriers = computed(() => this.allUsers().filter((u: any) => u.role === 'CARRIER').length);
  activeNegotiations = computed(() => this.allOrders().filter(o => o.status === 'ASSIGNED').length);
  inProgress         = computed(() => this.allOrders().filter(o => ['PICKUP_PENDING','PICKED_UP','IN_TRANSIT'].includes(o.status)).length);

  commissionToday = computed(() =>
    this.allOrders()
      .filter(o => ['DELIVERED','COMPLETED'].includes(o.status))
      .reduce((s, o) => s + ((o.proposed_price || 0) * 0.035), 0)
  );
  commissionWeek  = computed(() => this.commissionToday() * 6.2);
  commissionMonth = computed(() => this.commissionToday() * 24);

  matchRate     = computed(() => 94);
  avgTimeToMatch = computed(() => 42);

  matchingAlerts = computed(() => {
    const alerts: string[] = [];
    if (this.loadsAwaitingMatch() > 5) alerts.push(`${this.loadsAwaitingMatch()} chargements haute valeur sans transporteur`);
    return alerts;
  });

  negotiationAlerts = computed((): string[] => []);
  customerAlerts    = computed((): string[] => []);
  totalAlerts       = computed(() => this.matchingAlerts().length + this.negotiationAlerts().length + this.customerAlerts().length);

  pipelineStages = computed(() => [
    { label: 'BROKER.STAGE_NEW',        count: this.postedLoads().length,       last: false },
    { label: 'BROKER.STAGE_NEGOT',      count: this.activeNegotiations(),        last: false },
    { label: 'BROKER.STAGE_MATCHED',    count: this.inProgress(),                last: false },
    { label: 'BROKER.STAGE_ASSIGNED',   count: this.allOrders().filter(o => o.status === 'PICKUP_PENDING').length, last: false },
    { label: 'BROKER.STAGE_COMPLETED',  count: this.allOrders().filter(o => ['DELIVERED','COMPLETED'].includes(o.status)).length, last: true },
  ]);

  topDeals = computed(() =>
    this.allOrders()
      .filter(o => ['DELIVERED','COMPLETED'].includes(o.status) && o.proposed_price)
      .sort((a, b) => (b.proposed_price || 0) - (a.proposed_price || 0))
      .slice(0, 3)
      .map(o => ({
        reference: o.reference ?? '—',
        route: `${(o as any).pickup_city ?? 'Dakar'} → ${(o as any).delivery_city ?? 'Thiès'}`,
        commission: (o.proposed_price || 0) * 0.035,
      }))
  );

  recentActivity = computed(() => [
    { time: '09:12', type: 'info',    text: 'Chargement posté — Dakar → Saint-Louis' },
    { time: '09:45', type: 'success', text: 'Transporteur Thiossane assigné' },
    { time: '10:08', type: 'success', text: 'Tarif accepté — 280 000 CFA' },
    { time: '10:31', type: 'success', text: 'Chargement en transit ✓' },
    { time: '11:14', type: 'info',    text: `${this.loadsAwaitingMatch()} chargements en attente de match` },
  ]);
}
