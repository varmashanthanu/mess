import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, timer, EMPTY } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError, switchAll, tap, retryWhen, delay, takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type WsChannelType = 'tracking' | 'order' | 'chat';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private sockets = new Map<string, WebSocketSubject<unknown>>();
  private destroy$ = new Subject<void>();

  constructor(private auth: AuthService) {}

  connect<T>(channel: WsChannelType, id: string): Observable<T> {
    const key = `${channel}:${id}`;
    if (!this.sockets.has(key)) {
      const token = this.auth.getAccessToken();
      const url = this.buildUrl(channel, id, token);
      const socket$ = webSocket<T>({
        url,
        openObserver: { next: () => console.log(`WS connected: ${key}`) },
        closeObserver: { next: () => {
          console.log(`WS closed: ${key}`);
          this.sockets.delete(key);
        }},
      });
      this.sockets.set(key, socket$ as WebSocketSubject<unknown>);
    }
    return (this.sockets.get(key) as WebSocketSubject<T>).pipe(
      catchError((err) => {
        console.error(`WS error ${key}:`, err);
        this.sockets.delete(key);
        return EMPTY;
      }),
      takeUntil(this.destroy$)
    );
  }

  send<T>(channel: WsChannelType, id: string, data: T): void {
    const key = `${channel}:${id}`;
    const socket$ = this.sockets.get(key);
    if (socket$) {
      (socket$ as WebSocketSubject<T>).next(data);
    }
  }

  disconnect(channel: WsChannelType, id: string): void {
    const key = `${channel}:${id}`;
    const socket$ = this.sockets.get(key);
    if (socket$) {
      socket$.complete();
      this.sockets.delete(key);
    }
  }

  private buildUrl(channel: WsChannelType, id: string, token: string | null): string {
    const base = environment.wsUrl;
    const tokenParam = token ? `?token=${token}` : '';
    switch (channel) {
      case 'tracking': return `${base}/tracking/order/${id}/${tokenParam}`;
      case 'order':    return `${base}/orders/${id}/${tokenParam}`;
      case 'chat':     return `${base}/chat/${id}/${tokenParam}`;
      default:         return `${base}/${id}/${tokenParam}`;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sockets.forEach((s) => s.complete());
    this.sockets.clear();
  }
}
