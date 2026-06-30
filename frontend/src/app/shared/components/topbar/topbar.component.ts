import { Component, inject, output, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LanguageService } from '../../../core/services/language.service';
import { ApiService } from '../../../core/services/api.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <header class="topbar">
      <button class="menu-toggle" (click)="toggleSidebar.emit()">☰</button>

      <!-- User profile card -->
      <a class="topbar-profile" routerLink="/profile">
        <div class="tp-avatar">{{ initials() }}</div>
        <div class="tp-info">
          <div class="tp-name">{{ auth.user()?.full_name }}</div>
          <div class="tp-role">{{ roleKey() | translate }}</div>
        </div>
      </a>

      <div class="topbar-right">

        <!-- Driver / Carrier availability toggle -->
        <div class="availability-toggle" *ngIf="activeRole() === 'DRIVER' || activeRole() === 'CARRIER'">
          <span class="status-dot"
            [class.status-dot--online]="isAvailable()"
            [class.status-dot--offline]="!isAvailable()"></span>
          <span class="avail-label">
            {{ (isAvailable() ? 'TOPBAR.AVAILABLE' : 'TOPBAR.UNAVAILABLE') | translate }}
          </span>
          <button class="toggle-btn" [class.toggle-btn--on]="isAvailable()" (click)="toggleAvailability()" type="button">
            <span class="toggle-knob"></span>
          </button>
        </div>

        <!-- Language picker -->
        <div class="lang-picker">
          <button class="lang-btn" (click)="langOpen = !langOpen">
            <span>{{ langSvc.currentLang().flag }}</span>
            <span class="lang-code">{{ langSvc.currentLang().code | uppercase }}</span>
            <span class="lang-chevron">▾</span>
          </button>
          <div class="lang-dropdown" *ngIf="langOpen">
            <button
              *ngFor="let lang of langSvc.languages"
              class="lang-option"
              [class.active]="lang.code === langSvc.current()"
              (click)="selectLang(lang.code)">
              <span>{{ lang.flag }}</span>
              <span>{{ lang.label }}</span>
            </button>
          </div>
        </div>

        <!-- Dark mode toggle -->
        <button class="theme-toggle" (click)="themeSvc.toggle()" [title]="(themeSvc.isDark() ? 'TOPBAR.LIGHT_MODE' : 'TOPBAR.DARK_MODE') | translate">
          <span class="theme-icon">{{ themeSvc.isDark() ? '☀️' : '🌙' }}</span>
        </button>

        <!-- Notifications bell -->
        <a class="notif-btn" routerLink="/notifications">
          <span>🔔</span>
          <span class="notif-badge" *ngIf="notifSvc.unreadCount() > 0">
            {{ notifSvc.unreadCount() > 9 ? '9+' : notifSvc.unreadCount() }}
          </span>
        </a>

      </div>
    </header>
  `,
  styles: [`
    .topbar {
      height: var(--topbar-height);
      background: var(--topbar-bg, white);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 50;
      box-shadow: var(--shadow);
      transition: background-color 0.25s ease;
    }
    .menu-toggle {
      background: none; border: none; font-size: 22px; cursor: pointer;
      color: var(--text-primary); padding: 8px; border-radius: 8px; transition: background .15s;
    }
    .menu-toggle:hover { background: var(--gold-bg, rgba(201,162,39,0.08)); }
    .topbar-right { display: flex; align-items: center; gap: 10px; }
    .availability-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .avail-label { color: var(--text-secondary); font-weight: 500; }
    @media (max-width: 600px) {
      .topbar { padding: 0 12px; }
      .avail-label { display: none; }
      .lang-code, .lang-chevron { display: none; }
      .topbar-right { gap: 4px; }
    }
    .toggle-btn {
      position: relative; display: inline-block; width: 40px; height: 22px;
      background: var(--border, #BDBDBD); border-radius: 22px;
      border: none; cursor: pointer; transition: background .3s; padding: 0; flex-shrink: 0;
    }
    .toggle-btn--on { background: #43A047; }
    .toggle-knob {
      position: absolute; top: 3px; left: 3px;
      width: 16px; height: 16px; background: white; border-radius: 50%;
      transition: transform .3s;
    }
    .toggle-btn--on .toggle-knob { transform: translateX(18px); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .status-dot--online { background: #43A047; }
    .status-dot--offline { background: #9E9E9E; }

    /* Language picker */
    .lang-picker { position: relative; }
    .lang-btn {
      display: flex; align-items: center; gap: 5px; padding: 7px 10px;
      border: 1.5px solid var(--border); background: var(--surface); border-radius: 8px;
      cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-primary);
      transition: border-color .15s;
    }
    .lang-btn:hover { border-color: var(--gold); }
    .lang-chevron { font-size: 10px; color: var(--text-secondary); }
    .lang-dropdown {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; box-shadow: var(--shadow-lg); overflow: hidden; min-width: 140px; z-index: 200;
    }
    .lang-option {
      display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px;
      border: none; background: none; cursor: pointer; font-size: 13px;
      color: var(--text-primary); text-align: left; transition: background .1s;
    }
    .lang-option:hover { background: var(--surface-raised); }
    .lang-option.active { background: rgba(201,162,39,0.1); color: var(--gold); font-weight: 700; }

    /* Dark mode toggle */
    .theme-toggle {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: none; border: 1.5px solid var(--border);
      border-radius: 8px; cursor: pointer; transition: all .15s; font-size: 16px;
    }
    .theme-toggle:hover { border-color: var(--gold); background: var(--gold-bg, rgba(201,162,39,0.08)); }
    .theme-icon { line-height: 1; }

    /* Profile card in topbar */
    .topbar-profile {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; padding: 6px 12px; border-radius: 10px;
      transition: background .15s; flex: 1; justify-content: center;
      max-width: 260px;
    }
    .topbar-profile:hover { background: var(--gold-bg, rgba(201,162,39,0.08)); }
    .tp-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--gold); color: #fff; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .tp-info { display: flex; flex-direction: column; min-width: 0; }
    .tp-name {
      font-size: 14px; font-weight: 700; color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .tp-role { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
    @media (max-width: 600px) {
      .tp-info { display: none; }
      .topbar-profile { flex: unset; padding: 6px; }
    }

    /* Notifications */
    .notif-btn { position: relative; text-decoration: none; font-size: 20px; padding: 8px; border-radius: 8px; display: flex; align-items: center; }
    .notif-btn:hover { background: var(--surface-raised); }
    .notif-badge { position: absolute; top: 2px; right: 2px; background: #E53935; color: white; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 10px; min-width: 16px; text-align: center; }
  `]
})
export class TopbarComponent implements OnInit {
  toggleSidebar = output<void>();
  auth     = inject(AuthService);
  private wsService = inject(WorkspaceService);
  notifSvc = inject(NotificationService);
  langSvc  = inject(LanguageService);
  themeSvc = inject(ThemeService);
  private api = inject(ApiService);

  isAvailable = signal(false);
  langOpen = false;

  /** Workspace actif (type JWT) ou rôle DB en fallback */
  activeRole = computed(() => this.wsService.activeWorkspace()?.type || this.auth.role() || '');

  initials = computed(() => {
    const name = this.auth.user()?.full_name ?? '';
    return name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  });

  roleKey = computed(() => {
    const roleMap: Record<string, string> = {
      SHIPPER:    'PROFILE.ROLES.SHIPPER',
      DRIVER:     'PROFILE.ROLES.DRIVER',
      CARRIER:    'PROFILE.ROLES.CARRIER',
      BROKER:     'PROFILE.ROLES.BROKER',
      ADMIN:      'PROFILE.ROLES.ADMIN',
      SUPERADMIN: 'PROFILE.ROLES.SUPERADMIN',
      PERSONAL:   'PROFILE.ROLES.PERSONAL',
    };
    return roleMap[this.activeRole()] ?? '';
  });

  ngOnInit(): void {
    const role = this.activeRole();
    const u = this.auth.user() as any;
    if (role === 'DRIVER') {
      this.isAvailable.set(u?.driver_profile?.is_available ?? false);
    } else if (role === 'CARRIER') {
      this.isAvailable.set(u?.carrier_profile?.is_available ?? false);
    }
  }

  selectLang(code: string): void {
    this.langSvc.use(code);
    this.langOpen = false;
  }

  toggleAvailability(): void {
    const next = !this.isAvailable();
    const role = this.activeRole();

    console.log('[toggle] role=', role, 'next=', next);
    this.isAvailable.set(next);

    const update$ = role === 'CARRIER'
      ? this.api.updateCarrierProfile({ is_available: next })
      : this.api.updateDriverProfile({ is_available: next });

    update$.subscribe({
      next: (profile) => {
        console.log('[toggle] API success, profile.is_available=', profile.is_available);
        this.isAvailable.set(profile.is_available ?? next);
        const u = this.auth.user() as any;
        if (u) {
          if (role === 'DRIVER' && u.driver_profile) {
            this.auth.updateProfile({ ...u, driver_profile: { ...u.driver_profile, is_available: profile.is_available } });
          } else if (role === 'CARRIER' && u.carrier_profile) {
            this.auth.updateProfile({ ...u, carrier_profile: { ...u.carrier_profile, is_available: profile.is_available } });
          }
        }
      },
      error: (err) => {
        console.error('[toggle] API error:', err);
        this.isAvailable.set(!next);
      },
    });
  }
}
