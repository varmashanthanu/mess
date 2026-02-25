import { Injectable, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter((n) => !n.is_read).length);

  constructor(private api: ApiService) {
    this.load();
  }

  load(): void {
    this.api.getNotifications().subscribe({
      next: (res) => this._notifications.set(res.results),
      error: () => {},
    });
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe(() => {
      this._notifications.update((ns) => ns.map((n) => ({ ...n, is_read: true })));
    });
  }

  addNotification(n: Notification): void {
    this._notifications.update((ns) => [n, ...ns]);
  }
}
