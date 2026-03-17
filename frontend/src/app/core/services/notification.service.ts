import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { WebSocketService } from './websocket.service';
import { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter((n) => !n.is_read).length);

  private wsSub?: Subscription;

  constructor(private api: ApiService, private ws: WebSocketService) {
    this.load();
  }

  load(): void {
    this.api.getNotifications().subscribe({
      next: (res) => this._notifications.set(res.results),
      error: () => {},
    });
  }

  /** Call once after the user is authenticated (e.g. from ShellComponent). */
  connectWebSocket(): void {
    if (this.wsSub) return; // already connected
    this.wsSub = this.ws.connect<any>('notifications', '').subscribe({
      next: (msg) => {
        if (msg?.type === 'notification') {
          const n: Notification = {
            id: msg.id,
            notification_type: msg.notification_type,
            title: msg.title,
            body: msg.body,
            data: msg.data ?? {},
            is_read: false,
            created_at: msg.created_at,
          };
          // Prepend; avoid duplicates in case of reconnect + load overlap
          this._notifications.update((ns) =>
            ns.some((x) => x.id === n.id) ? ns : [n, ...ns]
          );
        }
      },
    });
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe(() => {
      this._notifications.update((ns) => ns.map((n) => ({ ...n, is_read: true })));
    });
  }

  /** Marks one notification read on the server, updates local state on success. */
  markOneRead(id: string): Observable<void> {
    return this.api.markNotificationRead(id).pipe(
      tap(() => {
        this._notifications.update((ns) =>
          ns.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      })
    );
  }

  addNotification(n: Notification): void {
    this._notifications.update((ns) => [n, ...ns]);
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }
}
