import {
  Component, input, output, signal, inject, OnDestroy, OnInit, ElementRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Subject, switchMap, debounceTime, distinctUntilChanged, of } from 'rxjs';

export interface LocationResult {
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
  };
}

@Component({
  selector: 'app-address-search',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="addr-wrap">
      <input
        type="text"
        class="addr-input"
        [(ngModel)]="query"
        [placeholder]="placeholder()"
        (ngModelChange)="onInput($event)"
        (focus)="showDropdown = results().length > 0"
        (blur)="onBlur()"
        (keydown.enter)="onEnter()"
        autocomplete="off"
      />
      <div class="addr-spinner" *ngIf="loading()">⏳</div>
      <ul class="addr-dropdown" *ngIf="showDropdown && results().length > 0">
        <li
          *ngFor="let r of results()"
          class="addr-option"
          (mousedown)="select(r)">
          <span class="addr-icon">📍</span>
          <span class="addr-text">{{ r.display_name }}</span>
        </li>
      </ul>
    </div>
  `,
  styles: [`
    .addr-wrap { position: relative; }
    .addr-input { width: 100%; padding: 10px 12px; border: 1.5px solid #E0E0E0; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; }
    .addr-input:focus { border-color: #FF6B35; }
    .addr-spinner { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 14px; }
    .addr-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid #E0E0E0; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 300; max-height: 240px; overflow-y: auto; margin: 0; padding: 4px 0; list-style: none; }
    .addr-option { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; cursor: pointer; font-size: 13px; line-height: 1.4; transition: background .1s; }
    .addr-option:hover { background: #FFF3F0; }
    .addr-icon { flex-shrink: 0; margin-top: 1px; }
    .addr-text { color: #212121; }
  `]
})
export class AddressSearchComponent implements OnDestroy, OnInit {
  placeholder = input('Search address...');
  initialValue = input('');

  locationSelected = output<LocationResult>();

  private http = inject(HttpClient);
  private el = inject(ElementRef);

  query = '';
  results = signal<NominatimResult[]>([]);
  loading = signal(false);
  showDropdown = false;

  private search$ = new Subject<string>();
  private sub = this.search$.pipe(
    debounceTime(350),
    distinctUntilChanged(),
    switchMap(q => {
      if (q.length < 3) { this.results.set([]); return of([]); }
      this.loading.set(true);
      return this.http.get<NominatimResult[]>(
        `https://nominatim.openstreetmap.org/search`,
        { params: { q, format: 'json', limit: '6', addressdetails: '1', countrycodes: 'sn,gm,gn,ml,mr,ci,bf' } }
      );
    })
  ).subscribe({
    next: (res) => {
      this.results.set(res as NominatimResult[]);
      this.showDropdown = (res as NominatimResult[]).length > 0;
      this.loading.set(false);
    },
    error: () => this.loading.set(false),
  });

  ngOnInit(): void {
    if (this.initialValue()) {
      this.query = this.initialValue();
    }
  }

  onInput(val: string): void {
    this.search$.next(val);
    if (!val) { this.results.set([]); this.showDropdown = false; }
  }

  select(r: NominatimResult): void {
    this.query = r.display_name;
    this.showDropdown = false;
    const city = r.address.city || r.address.town || r.address.village || r.address.county || r.address.state || '';
    this.locationSelected.emit({
      address: r.display_name,
      city,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    });
  }

  onBlur(): void {
    setTimeout(() => {
      this.showDropdown = false;
      if (this.query.trim()) {
        this.emitFreeText();
      }
    }, 200);
  }

  onEnter(): void {
    this.showDropdown = false;
    if (this.query.trim()) {
      this.emitFreeText();
    }
  }

  private emitFreeText(): void {
    this.locationSelected.emit({
      address: this.query.trim(),
      city: '',
      lat: null,
      lng: null,
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (!this.el.nativeElement.contains(e.target)) {
      this.showDropdown = false;
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
