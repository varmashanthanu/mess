import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface AdminUser {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  is_superuser: boolean;
  is_verified: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  permissions: AdminPermissions | null;
}

interface AdminPermissions {
  can_manage_users: boolean;
  can_manage_fleet: boolean;
  can_manage_orders: boolean;
  can_manage_finance: boolean;
  can_manage_analytics: boolean;
  can_manage_messaging: boolean;
  can_manage_tracking: boolean;
  can_view_governance: boolean;
}

interface SystemStats {
  disk: { total_gb: number; used_gb: number; free_gb: number; pct: number };
  memory: { total_mb: number; used_mb: number; free_mb: number; pct: number };
  cpu: { load_1: number; load_5: number; load_15: number };
  uptime_hours: number;
  database: { table_count: number; active_connections: number; total_connections: number; users: number; orders: number; messages: number };
}

type Tab = 'admins' | 'system';

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="sa-page">

      <!-- ══ HERO ══ -->
      <div class="sa-hero">
        <div>
          <div class="sa-badge">🔑 SUPER ADMIN</div>
          <div class="sa-title">Espace Super Administrateur</div>
          <div class="sa-sub">Gestion des administrateurs et supervision du système</div>
        </div>
        <a routerLink="/admin" class="sa-back-btn">← Retour au Dashboard</a>
      </div>

      <!-- ══ TABS ══ -->
      <div class="sa-tabs">
        <button class="sa-tab" [class.active]="tab() === 'admins'" (click)="tab.set('admins')">
          👤 Administrateurs
        </button>
        <button class="sa-tab" [class.active]="tab() === 'system'" (click)="loadSystem(); tab.set('system')">
          🖥 Monitoring Système
        </button>
      </div>

      <!-- ══ ADMINS TAB ══ -->
      <ng-container *ngIf="tab() === 'admins'">

        <div class="two-col">
          <!-- Admin list -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">👥 Administrateurs ({{ admins().length }})</span>
              <button class="btn-new" (click)="openCreate()">+ Nouvel admin</button>
            </div>

            <div class="loading" *ngIf="loadingAdmins()">Chargement...</div>

            <div class="admin-row" *ngFor="let a of admins()" [class.selected]="selectedAdmin()?.id === a.id" (click)="selectAdmin(a)">
              <div class="admin-avatar">{{ initials(a.full_name) }}</div>
              <div class="admin-info">
                <div class="admin-name">{{ a.full_name }}
                  <span class="badge-super" *ngIf="a.is_superuser">SUPER</span>
                </div>
                <div class="admin-phone">{{ a.phone_number }}</div>
              </div>
              <div class="admin-status">
                <span class="dot-active" *ngIf="a.is_active"></span>
                <span class="dot-inactive" *ngIf="!a.is_active"></span>
              </div>
            </div>

            <div class="empty" *ngIf="!loadingAdmins() && !admins().length">Aucun administrateur</div>
          </div>

          <!-- Right: create form OR permissions -->
          <div class="panel" *ngIf="showCreateForm()">
            <div class="panel-header">
              <span class="panel-title">➕ Créer un administrateur</span>
              <button class="btn-close" (click)="showCreateForm.set(false)">✕</button>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Prénom *</label>
                <input [(ngModel)]="newAdmin.first_name" placeholder="Amadou" />
              </div>
              <div class="form-group">
                <label>Nom *</label>
                <input [(ngModel)]="newAdmin.last_name" placeholder="Diallo" />
              </div>
              <div class="form-group">
                <label>Téléphone *</label>
                <input [(ngModel)]="newAdmin.phone_number" placeholder="+221771234567" />
              </div>
              <div class="form-group">
                <label>Email</label>
                <input [(ngModel)]="newAdmin.email" placeholder="admin@yoolo.sn" type="email" />
              </div>
              <div class="form-group form-group--full">
                <label>Mot de passe *</label>
                <input [(ngModel)]="newAdmin.password" type="password" placeholder="••••••••" />
              </div>
            </div>
            <div class="form-error" *ngIf="createError()">{{ createError() }}</div>
            <div class="form-success" *ngIf="createSuccess()">✓ Administrateur créé !</div>
            <button class="btn-create" (click)="createAdmin()" [disabled]="creating()">
              {{ creating() ? 'Création...' : 'Créer le compte admin' }}
            </button>
          </div>

          <div class="panel" *ngIf="selectedAdmin() && !showCreateForm()">
            <div class="panel-header">
              <span class="panel-title">🔐 Permissions — {{ selectedAdmin()!.full_name }}</span>
              <button class="btn-delete" *ngIf="!selectedAdmin()!.is_superuser" (click)="deleteAdmin(selectedAdmin()!)">🗑 Supprimer</button>
            </div>

            <div class="perm-grid" *ngIf="editPerms">
              <div class="perm-row" *ngFor="let p of permKeys">
                <label class="perm-label">{{ p.label }}</label>
                <label class="toggle">
                  <input type="checkbox" [(ngModel)]="editPerms[p.key]" />
                  <span class="toggle-track"></span>
                </label>
              </div>
            </div>

            <div class="perm-actions">
              <button class="btn-save" (click)="savePermissions()" [disabled]="savingPerms()">
                {{ savingPerms() ? 'Sauvegarde...' : '✓ Sauvegarder les permissions' }}
              </button>
              <div class="perm-success" *ngIf="permSaved()">✓ Permissions mises à jour</div>
            </div>
          </div>
        </div>

      </ng-container>

      <!-- ══ SYSTEM TAB ══ -->
      <ng-container *ngIf="tab() === 'system'">
        <div class="loading" *ngIf="loadingSystem()">Chargement des métriques système...</div>

        <ng-container *ngIf="systemStats()">
          <div class="sys-grid">

            <!-- CPU -->
            <div class="sys-card">
              <div class="sys-card-icon">⚡</div>
              <div class="sys-card-title">CPU Load Average</div>
              <div class="sys-vals">
                <div class="sys-val-row"><span class="sys-period">1 min</span> <span class="sys-num" [class.sys-warn]="systemStats()!.cpu.load_1 > 1">{{ systemStats()!.cpu.load_1 }}</span></div>
                <div class="sys-val-row"><span class="sys-period">5 min</span> <span class="sys-num">{{ systemStats()!.cpu.load_5 }}</span></div>
                <div class="sys-val-row"><span class="sys-period">15 min</span> <span class="sys-num">{{ systemStats()!.cpu.load_15 }}</span></div>
              </div>
              <div class="sys-uptime">Uptime: {{ systemStats()!.uptime_hours }}h</div>
            </div>

            <!-- Memory -->
            <div class="sys-card">
              <div class="sys-card-icon">🧠</div>
              <div class="sys-card-title">Mémoire RAM</div>
              <div class="sys-bar-wrap">
                <div class="sys-bar">
                  <div class="sys-bar-fill" [class.sys-bar--warn]="systemStats()!.memory.pct > 80" [style.width.%]="systemStats()!.memory.pct"></div>
                </div>
                <span class="sys-bar-pct">{{ systemStats()!.memory.pct }}%</span>
              </div>
              <div class="sys-vals">
                <div class="sys-val-row"><span class="sys-period">Utilisée</span> <span class="sys-num">{{ systemStats()!.memory.used_mb | number:'1.0-0' }} MB</span></div>
                <div class="sys-val-row"><span class="sys-period">Libre</span> <span class="sys-num sys-ok">{{ systemStats()!.memory.free_mb | number:'1.0-0' }} MB</span></div>
                <div class="sys-val-row"><span class="sys-period">Total</span> <span class="sys-num">{{ systemStats()!.memory.total_mb | number:'1.0-0' }} MB</span></div>
              </div>
            </div>

            <!-- Disk -->
            <div class="sys-card">
              <div class="sys-card-icon">💾</div>
              <div class="sys-card-title">Disque</div>
              <div class="sys-bar-wrap">
                <div class="sys-bar">
                  <div class="sys-bar-fill" [class.sys-bar--warn]="systemStats()!.disk.pct > 80" [style.width.%]="systemStats()!.disk.pct"></div>
                </div>
                <span class="sys-bar-pct">{{ systemStats()!.disk.pct }}%</span>
              </div>
              <div class="sys-vals">
                <div class="sys-val-row"><span class="sys-period">Utilisé</span> <span class="sys-num">{{ systemStats()!.disk.used_gb }} GB</span></div>
                <div class="sys-val-row"><span class="sys-period">Libre</span> <span class="sys-num sys-ok">{{ systemStats()!.disk.free_gb }} GB</span></div>
                <div class="sys-val-row"><span class="sys-period">Total</span> <span class="sys-num">{{ systemStats()!.disk.total_gb }} GB</span></div>
              </div>
            </div>

            <!-- Database -->
            <div class="sys-card">
              <div class="sys-card-icon">🗄</div>
              <div class="sys-card-title">Base de données</div>
              <div class="sys-vals">
                <div class="sys-val-row"><span class="sys-period">Tables</span> <span class="sys-num">{{ systemStats()!.database.table_count }}</span></div>
                <div class="sys-val-row"><span class="sys-period">Connexions actives</span> <span class="sys-num" [class.sys-warn]="systemStats()!.database.active_connections > 10">{{ systemStats()!.database.active_connections }}</span></div>
                <div class="sys-val-row"><span class="sys-period">Total connexions</span> <span class="sys-num">{{ systemStats()!.database.total_connections }}</span></div>
              </div>
            </div>

          </div>

          <!-- DB Row counts -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">📊 Statistiques de la base de données</span>
              <button class="btn-refresh" (click)="loadSystem()">🔄 Actualiser</button>
            </div>
            <div class="db-stats-grid">
              <div class="db-stat">
                <div class="db-stat-val">{{ systemStats()!.database.users | number }}</div>
                <div class="db-stat-lbl">👤 Utilisateurs</div>
              </div>
              <div class="db-stat">
                <div class="db-stat-val">{{ systemStats()!.database.orders | number }}</div>
                <div class="db-stat-lbl">📦 Commandes</div>
              </div>
              <div class="db-stat">
                <div class="db-stat-val">{{ systemStats()!.database.messages | number }}</div>
                <div class="db-stat-lbl">💬 Messages</div>
              </div>
              <div class="db-stat">
                <div class="db-stat-val">{{ systemStats()!.database.table_count }}</div>
                <div class="db-stat-lbl">🗄 Tables DB</div>
              </div>
            </div>
          </div>

        </ng-container>

      </ng-container>

    </div>
  `,
  styles: [`
    .sa-page { max-width: 1280px; display: flex; flex-direction: column; gap: 16px; }

    /* Hero */
    .sa-hero {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      background: linear-gradient(135deg, #0D0D0D 0%, #1A1A2E 100%);
      border-radius: 16px; padding: 24px 28px;
      border: 1px solid rgba(201,162,39,0.3); box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    .sa-badge { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #C9A227; margin-bottom: 6px; }
    .sa-title { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 4px; }
    .sa-sub   { font-size: 13px; color: rgba(255,255,255,0.5); }
    .sa-back-btn {
      padding: 10px 18px; border: 1.5px solid rgba(255,255,255,0.2); border-radius: 10px;
      color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; text-decoration: none;
      white-space: nowrap; transition: all .15s;
    }
    .sa-back-btn:hover { border-color: #C9A227; color: #C9A227; }

    /* Tabs */
    .sa-tabs { display: flex; gap: 8px; }
    .sa-tab {
      padding: 10px 20px; border-radius: 10px; border: 1.5px solid var(--border);
      background: var(--surface); color: var(--text-secondary); font-size: 13px;
      font-weight: 700; cursor: pointer; transition: all .12s;
    }
    .sa-tab.active { border-color: #C9A227; color: #C9A227; background: rgba(201,162,39,0.08); }

    /* Layout */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel {
      background: var(--surface); border-radius: 14px; padding: 20px;
      border: 1px solid var(--border); box-shadow: var(--shadow);
    }
    .panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .panel-title  { flex: 1; font-size: 13px; font-weight: 800; color: var(--text-primary); }

    /* Admin list */
    .admin-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 10px; cursor: pointer; border: 1.5px solid transparent;
      transition: all .12s; margin-bottom: 6px;
    }
    .admin-row:hover { background: var(--surface-raised); border-color: var(--border); }
    .admin-row.selected { border-color: #C9A227; background: rgba(201,162,39,0.06); }
    .admin-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; flex-shrink: 0;
    }
    .admin-info  { flex: 1; min-width: 0; }
    .admin-name  { font-size: 13px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px; }
    .admin-phone { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .badge-super { background: rgba(201,162,39,0.2); color: #C9A227; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 8px; letter-spacing: 0.5px; }
    .dot-active   { width: 8px; height: 8px; border-radius: 50%; background: #66BB6A; flex-shrink: 0; }
    .dot-inactive { width: 8px; height: 8px; border-radius: 50%; background: #9E9A93; flex-shrink: 0; }

    /* Buttons */
    .btn-new { padding: 7px 14px; background: #C9A227; color: #111; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .btn-close { background: none; border: none; font-size: 16px; color: var(--text-secondary); cursor: pointer; padding: 4px; }
    .btn-delete { padding: 6px 12px; background: rgba(229,57,53,0.1); color: #E53935; border: 1px solid rgba(229,57,53,0.3); border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .btn-save { padding: 10px 20px; background: #C9A227; color: #111; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-refresh { padding: 6px 12px; background: var(--surface-raised); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
    .btn-create { width: 100%; padding: 12px; background: linear-gradient(135deg, #C9A227, #A8861F); color: #111; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; margin-top: 8px; }
    .btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Create form */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group--full { grid-column: span 2; }
    .form-group label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
    .form-group input { padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--surface-raised); color: var(--text-primary); font-family: inherit; outline: none; }
    .form-group input:focus { border-color: #C9A227; }
    .form-error   { color: #E53935; font-size: 12px; margin-top: 8px; }
    .form-success { color: #66BB6A; font-size: 12px; margin-top: 8px; font-weight: 600; }

    /* Permissions */
    .perm-grid { display: flex; flex-direction: column; gap: 0; }
    .perm-row  { display: flex; align-items: center; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid var(--border); }
    .perm-row:last-child { border-bottom: none; }
    .perm-label { font-size: 13px; color: var(--text-primary); font-weight: 500; }
    .perm-actions { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
    .perm-success { font-size: 12px; color: #66BB6A; font-weight: 600; }
    /* Toggle */
    .toggle { display: inline-flex; cursor: pointer; }
    .toggle input { display: none; }
    .toggle-track { width: 40px; height: 22px; border-radius: 11px; background: var(--border); position: relative; transition: background .2s; }
    .toggle input:checked + .toggle-track { background: #C9A227; }
    .toggle-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform .2s; }
    .toggle input:checked + .toggle-track::after { transform: translateX(18px); }

    /* System monitoring */
    .sys-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 16px; }
    .sys-card { background: var(--surface); border-radius: 14px; padding: 18px; border: 1px solid var(--border); }
    .sys-card-icon  { font-size: 22px; margin-bottom: 6px; }
    .sys-card-title { font-size: 12px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 12px; }
    .sys-vals { display: flex; flex-direction: column; gap: 6px; }
    .sys-val-row { display: flex; justify-content: space-between; align-items: center; }
    .sys-period { font-size: 11px; color: var(--text-secondary); }
    .sys-num { font-size: 14px; font-weight: 800; color: var(--text-primary); }
    .sys-num.sys-warn { color: #FFB300; }
    .sys-num.sys-ok   { color: #66BB6A; }
    .sys-uptime { font-size: 11px; color: var(--text-secondary); margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; }
    /* Bar */
    .sys-bar-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .sys-bar { flex: 1; height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; }
    .sys-bar-fill { height: 100%; border-radius: 4px; background: #66BB6A; transition: width .3s; }
    .sys-bar-fill.sys-bar--warn { background: #FFB300; }
    .sys-bar-pct { font-size: 12px; font-weight: 700; color: var(--text-primary); min-width: 38px; text-align: right; }
    /* DB stats */
    .db-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
    .db-stat { text-align: center; padding: 16px 12px; border-radius: 10px; background: var(--surface-raised); border: 1px solid var(--border); }
    .db-stat-val { font-size: 24px; font-weight: 800; color: var(--text-primary); }
    .db-stat-lbl { font-size: 11px; color: var(--text-secondary); font-weight: 600; margin-top: 4px; }

    /* Misc */
    .loading { padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px; }
    .empty   { padding: 16px; text-align: center; color: var(--text-secondary); font-size: 13px; }

    @media (max-width: 900px) {
      .two-col { grid-template-columns: 1fr; }
      .sys-grid { grid-template-columns: repeat(2,1fr); }
      .db-stats-grid { grid-template-columns: repeat(2,1fr); }
    }
  `]
})
export class SuperAdminComponent implements OnInit {
  private http = inject(HttpClient);
  auth = inject(AuthService);

  private readonly apiBase = `${environment.apiUrl}/superadmin`;

  tab            = signal<Tab>('admins');
  admins         = signal<AdminUser[]>([]);
  selectedAdmin  = signal<AdminUser | null>(null);
  loadingAdmins  = signal(true);
  loadingSystem  = signal(false);
  systemStats    = signal<SystemStats | null>(null);
  showCreateForm = signal(false);
  creating       = signal(false);
  createError    = signal('');
  createSuccess  = signal(false);
  savingPerms    = signal(false);
  permSaved      = signal(false);

  newAdmin = { first_name: '', last_name: '', phone_number: '', email: '', password: '' };
  editPerms: Record<string, boolean> | null = null;

  permKeys = [
    { key: 'can_manage_users',     label: 'Gestion des utilisateurs' },
    { key: 'can_manage_fleet',     label: 'Gestion de la flotte' },
    { key: 'can_manage_orders',    label: 'Gestion des commandes' },
    { key: 'can_manage_finance',   label: 'Finance & Paiements' },
    { key: 'can_manage_analytics', label: 'Analytique & KPIs' },
    { key: 'can_manage_messaging', label: 'Messagerie' },
    { key: 'can_manage_tracking',  label: 'Suivi & Tracking' },
    { key: 'can_view_governance',  label: 'Gouvernance & Audit' },
  ];

  ngOnInit(): void {
    this.loadAdmins();
  }

  private headers(): HttpHeaders {
    const token = this.auth.getAccessToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadAdmins(): void {
    this.loadingAdmins.set(true);
    this.http.get<{ results: AdminUser[] }>(`${this.apiBase}/admins/`, { headers: this.headers() }).subscribe({
      next: r => { this.admins.set(r.results ?? []); this.loadingAdmins.set(false); },
      error: () => this.loadingAdmins.set(false),
    });
  }

  loadSystem(): void {
    this.loadingSystem.set(true);
    this.http.get<SystemStats>(`${this.apiBase}/system/`, { headers: this.headers() }).subscribe({
      next: r => { this.systemStats.set(r); this.loadingSystem.set(false); },
      error: () => this.loadingSystem.set(false),
    });
  }

  selectAdmin(a: AdminUser): void {
    this.selectedAdmin.set(a);
    this.showCreateForm.set(false);
    this.permSaved.set(false);
    this.editPerms = a.permissions ? { ...a.permissions } : {
      can_manage_users: true, can_manage_fleet: true, can_manage_orders: true,
      can_manage_finance: true, can_manage_analytics: true, can_manage_messaging: true,
      can_manage_tracking: true, can_view_governance: false,
    };
    // Fetch fresh permissions
    this.http.get<AdminPermissions>(`${this.apiBase}/admins/${a.id}/permissions/`, { headers: this.headers() }).subscribe({
      next: p => { this.editPerms = { ...p }; },
    });
  }

  openCreate(): void {
    this.selectedAdmin.set(null);
    this.showCreateForm.set(true);
    this.createError.set('');
    this.createSuccess.set(false);
    this.newAdmin = { first_name: '', last_name: '', phone_number: '', email: '', password: '' };
  }

  createAdmin(): void {
    if (!this.newAdmin.first_name || !this.newAdmin.last_name || !this.newAdmin.phone_number || !this.newAdmin.password) {
      this.createError.set('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    this.creating.set(true);
    this.createError.set('');
    this.http.post<AdminUser>(`${this.apiBase}/admins/`, this.newAdmin, { headers: this.headers() }).subscribe({
      next: a => {
        this.creating.set(false);
        this.createSuccess.set(true);
        this.admins.update(list => [...list, a]);
        setTimeout(() => this.showCreateForm.set(false), 1500);
      },
      error: err => {
        this.creating.set(false);
        const msg = err.error?.phone_number?.[0] ?? err.error?.detail ?? 'Erreur lors de la création.';
        this.createError.set(msg);
      },
    });
  }

  savePermissions(): void {
    const a = this.selectedAdmin();
    if (!a || !this.editPerms) return;
    this.savingPerms.set(true);
    this.http.patch(`${this.apiBase}/admins/${a.id}/permissions/`, this.editPerms, { headers: this.headers() }).subscribe({
      next: () => { this.savingPerms.set(false); this.permSaved.set(true); },
      error: () => this.savingPerms.set(false),
    });
  }

  deleteAdmin(a: AdminUser): void {
    if (!confirm(`Supprimer l'administrateur ${a.full_name} ?`)) return;
    this.http.delete(`${this.apiBase}/admins/${a.id}/`, { headers: this.headers() }).subscribe({
      next: () => {
        this.admins.update(list => list.filter(x => x.id !== a.id));
        this.selectedAdmin.set(null);
      },
    });
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
