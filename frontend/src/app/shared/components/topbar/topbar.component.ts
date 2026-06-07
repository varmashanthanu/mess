import { Component, inject, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
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

      <div class="topbar-right">

        <!-- Driver availability toggle -->
        <div class="availability-toggle" *ngIf="auth.role() === 'DRIVER'">
          <span class="status-dot"
            [class.status-dot--online]="isAvailable"
            [class.status-dot--offline]="!isAvailable"></span>
          <span class="avail-label">
            {{ (isAvailable ? 'TOPBAR.AVAILABLE' : 'TOPBAR.UNAVAILABLE') | translate }}
          </span>
          <label class="toggle-switch">
            <input type="checkbox" [checked]="isAvailable" (change)="toggleAvailability()">
            <span class="slider slider--green"></span>
          </label>
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
    .toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; inset: 0; background: var(--border, #BDBDBD); border-radius: 22px; transition: .3s; }
    .slider:before { position: absolute; content: ''; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
    input:checked + .slider--green { background: #43A047; }
    input:checked + .slider--green:before { transform: translateX(18px); }
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

    /* Notifications */
    .notif-btn { position: relative; text-decoration: none; font-size: 20px; padding: 8px; border-radius: 8px; display: flex; align-items: center; }
    .notif-btn:hover { background: var(--surface-raised); }
    .notif-badge { position: absolute; top: 2px; right: 2px; background: #E53935; color: white; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 10px; min-width: 16px; text-align: center; }
  `]
})
export class TopbarComponent implements OnInit {
  toggleSidebar = output<void>();
  auth = inject(AuthService);
  notifSvc = inject(NotificationService);
  langSvc = inject(LanguageService);
  themeSvc = inject(ThemeService);
  private api = inject(ApiService);

  isAvailable = false;
  langOpen = false;

  ngOnInit(): void {
    this.isAvailable = this.auth.user()?.driver_profile?.is_available ?? false;
  }

  selectLang(code: string): void {
    this.langSvc.use(code);
    this.langOpen = false;
  }

  toggleAvailability(): void {
    const next = !this.isAvailable;
    this.api.updateDriverAvailability(next).subscribe({
      next: (driverProfile) => {
        this.isAvailable = driverProfile.is_available;
        // Keep the auth user signal in sync so ngOnInit reads correctly on re-mount
        const u = this.auth.user();
        if (u && u.driver_profile) {
          this.auth.updateProfile({ ...u, driver_profile: { ...u.driver_profile, is_available: driverProfile.is_available } });
        }
      },
    });
  }
}
