import { Component, OnInit, OnDestroy, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { DriverLocation } from '../../core/models/tracking.model';
import { environment } from '../../../environments/environment';

// Fix Leaflet default icon paths for webpack bundles
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({
  iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="tracking-page">
      <div class="page-header">
        <h1>{{ 'TRACKING.TITLE' | translate }}</h1>
        <div class="tracking-controls">
          <span class="status-dot" [class.status-dot--online]="wsConnected()" [class.status-dot--offline]="!wsConnected()"></span>
          <span class="text-sm text-muted">{{ (wsConnected() ? 'TOPBAR.REALTIME' : 'TOPBAR.DISCONNECTED') | translate }}</span>
          <button class="btn-refresh" (click)="loadDrivers()">{{ 'TRACKING.REFRESH' | translate }}</button>
        </div>
      </div>

      <div class="tracking-layout">
        <!-- Map -->
        <div class="map-wrap">
          <div id="tracking-map" class="map-container"></div>
        </div>

        <!-- Driver list sidebar -->
        <div class="drivers-panel">
          <h3>{{ 'TRACKING.DRIVERS_PANEL' | translate: { count: drivers().length } }} ({{ drivers().length }})</h3>
          <div class="driver-list">
            <div class="driver-item"
              *ngFor="let d of drivers()"
              (click)="centerOnDriver(d)"
              [class.active]="selectedDriver()?.driver_id === d.driver_id">
              <div class="driver-item-header">
                <span class="status-dot" [class.status-dot--online]="d.is_available" [class.status-dot--offline]="!d.is_available"></span>
                <strong>{{ d.driver_name }}</strong>
              </div>
              <div class="driver-item-meta text-sm text-muted">
                <span *ngIf="d.speed_kmh != null">{{ d.speed_kmh | number:'1.0-0' }} km/h</span>
                <span>{{ d.timestamp | date:'HH:mm' }}</span>
              </div>
            </div>
            <div class="empty-state" *ngIf="!drivers().length">
              <div class="empty-icon">🚛</div>
              <p>{{ 'TRACKING.EMPTY_TITLE' | translate }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tracking-page { display: flex; flex-direction: column; height: calc(100vh - var(--topbar-height) - 48px); }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-shrink: 0; }
    h1 { font-size: 24px; font-weight: 700; }
    h3 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
    .tracking-controls { display: flex; align-items: center; gap: 10px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .status-dot--online { background: #00C896; }
    .status-dot--offline { background: #9E9E9E; }
    .btn-refresh { padding: 7px 14px; border: 1px solid #E0E0E0; background: white; border-radius: 8px; cursor: pointer; font-size: 13px; }
    .tracking-layout { display: grid; grid-template-columns: 1fr 280px; gap: 16px; flex: 1; min-height: 0; }
    .map-wrap { border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    #tracking-map { width: 100%; height: 100%; min-height: 400px; }
    .drivers-panel { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
    .driver-list { flex: 1; overflow-y: auto; }
    .driver-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; transition: background .15s; }
    .driver-item:hover, .driver-item.active { background: #FFF3F0; }
    .driver-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .driver-item-meta { display: flex; justify-content: space-between; margin-left: 16px; }
    .text-sm { font-size: 12px; } .text-muted { color: #757575; }
    .empty-state { text-align: center; padding: 24px; color: #757575; }
    .empty-icon { font-size: 32px; margin-bottom: 8px; }
    @media (max-width: 768px) { .tracking-layout { grid-template-columns: 1fr; } .drivers-panel { max-height: 200px; } }
  `]
})
export class TrackingComponent implements OnInit, AfterViewInit, OnDestroy {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private ws = inject(WebSocketService);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  drivers = signal<DriverLocation[]>([]);
  selectedDriver = signal<DriverLocation | null>(null);
  wsConnected = signal(false);

  private map!: L.Map;
  private markers = new Map<string, L.Marker>();
  private subs: Subscription[] = [];
  private orderId: string | null = null;

  ngOnInit(): void {
    this.orderId = this.route.snapshot.queryParamMap.get('order');
    this.loadDrivers();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  initMap(): void {
    this.map = L.map('tracking-map', {
      center: [environment.defaultCenter.lat, environment.defaultCenter.lng],
      zoom: environment.defaultZoom,
    });

    L.tileLayer(environment.mapTileUrl, {
      attribution: environment.mapAttribution,
      maxZoom: 19,
    }).addTo(this.map);

    // If tracking a specific order, connect to WS
    if (this.orderId) {
      this.connectOrderWs(this.orderId);
    }

    // Driver sends own location
    if (this.auth.hasRole('DRIVER') && this.orderId) {
      this.startGpsStream(this.orderId);
    }
  }

  loadDrivers(): void {
    this.api.getAvailableDrivers().subscribe({
      next: (list) => {
        this.drivers.set(list);
        list.forEach(d => this.updateMarker(d));
      },
    });
  }

  private updateMarker(d: DriverLocation): void {
    if (!this.map) return;
    const color = d.is_available ? '#00C896' : '#9E9E9E';
    const icon = L.divIcon({
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9], className: '',
    });

    if (this.markers.has(d.driver_id)) {
      const m = this.markers.get(d.driver_id)!;
      m.setLatLng([d.latitude, d.longitude]);
      m.setIcon(icon);
    } else {
      const m = L.marker([d.latitude, d.longitude], { icon })
        .bindPopup(`<b>${d.driver_name}</b><br>${d.is_available
          ? '🟢 ' + this.translate.instant('TOPBAR.AVAILABLE')
          : '⚫ ' + this.translate.instant('TOPBAR.UNAVAILABLE')
        }`)
        .addTo(this.map);
      this.markers.set(d.driver_id, m);
    }
  }

  centerOnDriver(d: DriverLocation): void {
    this.selectedDriver.set(d);
    this.map?.setView([d.latitude, d.longitude], 14);
    this.markers.get(d.driver_id)?.openPopup();
  }

  private connectOrderWs(orderId: string): void {
    const sub = this.ws.connect<any>('tracking', orderId).subscribe({
      next: (msg) => {
        this.wsConnected.set(true);
        if (msg?.type === 'location_update' && msg.data) {
          const d = msg.data as DriverLocation;
          this.drivers.update(ds => {
            const idx = ds.findIndex(x => x.driver_id === d.driver_id);
            if (idx >= 0) { const copy = [...ds]; copy[idx] = d; return copy; }
            return [d, ...ds];
          });
          this.updateMarker(d);
        }
      },
      error: () => this.wsConnected.set(false),
    });
    this.subs.push(sub);
  }

  private startGpsStream(orderId: string): void {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.ws.send('tracking', orderId, {
          type: 'location_update',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
          accuracy_m: pos.coords.accuracy,
        });
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    this.subs.push({ unsubscribe: () => navigator.geolocation.clearWatch(watchId) } as any);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.map?.remove();
  }
}
