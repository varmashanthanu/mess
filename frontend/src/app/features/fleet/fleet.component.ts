import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { Vehicle } from '../../core/models/fleet.model';

@Component({
  selector: 'app-fleet',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="fleet-page">
      <div class="page-header">
        <h1>{{ 'FLEET.TITLE' | translate }}</h1>
        <button class="btn-primary" (click)="showForm.set(!showForm())">
          {{ (showForm() ? 'FLEET.ADD_CANCEL' : 'FLEET.ADD_BTN') | translate }}
        </button>
      </div>

      <!-- Add form -->
      <div class="card add-form" *ngIf="showForm()">
        <h3>{{ 'FLEET.ADD_FORM_TITLE' | translate }}</h3>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ 'FLEET.PLATE' | translate }}</label>
              <input type="text" formControlName="registration_number" placeholder="DK-1234-AB" />
            </div>
            <div class="form-group">
              <label>{{ 'FLEET.MAKE' | translate }}</label>
              <input type="text" formControlName="make" placeholder="Mercedes" />
            </div>
            <div class="form-group">
              <label>{{ 'FLEET.MODEL' | translate }}</label>
              <input type="text" formControlName="model" placeholder="Actros" />
            </div>
            <div class="form-group">
              <label>{{ 'FLEET.YEAR' | translate }}</label>
              <input type="number" formControlName="year" placeholder="2020" min="1980" max="2030" />
            </div>
            <div class="form-group">
              <label>{{ 'FLEET.PAYLOAD' | translate }}</label>
              <input type="number" formControlName="payload_kg" placeholder="20000" min="100" />
            </div>
            <div class="form-group">
              <label>{{ 'FLEET.VEHICLE_TYPE' | translate }}</label>
              <select formControlName="vehicle_type">
                <option value="">{{ 'FLEET.VEHICLE_TYPE_SELECT' | translate }}</option>
                <option *ngFor="let t of vehicleTypes()" [value]="t.id">{{ t.name }}</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary" [disabled]="submitting()">
              {{ (submitting() ? 'FLEET.SAVING' : 'FLEET.SAVE') | translate }}
            </button>
          </div>
        </form>
      </div>

      <!-- Vehicle list -->
      <div class="loading-overlay" *ngIf="loading()">⏳ {{ 'COMMON.LOADING' | translate }}</div>

      <div class="vehicles-grid" *ngIf="!loading()">
        <div class="vehicle-card card" *ngFor="let v of vehicles()">
          <div class="vehicle-header">
            <div class="vehicle-plate">{{ v.registration_number }}</div>
            <span class="status-badge" [class.active]="v.is_active">{{ (v.is_active ? 'FLEET.STATUS_ACTIVE' : 'FLEET.STATUS_INACTIVE') | translate }}</span>
          </div>
          <div class="vehicle-name">{{ v.make }} {{ v.model }} ({{ v.year }})</div>
          <div class="vehicle-meta">
            <span>🏋️ {{ v.payload_kg | number }} kg</span>
            <span>📋 {{ v.vehicle_type_name }}</span>
          </div>
          <div class="vehicle-owner text-sm text-muted" *ngIf="v.owner_name">
            {{ 'FLEET.OWNER' | translate }}: {{ v.owner_name }}
          </div>
        </div>

        <div class="empty-state" *ngIf="!vehicles().length">
          <div class="empty-icon">🚚</div>
          <h3>{{ 'FLEET.EMPTY_TITLE' | translate }}</h3>
          <p>{{ 'FLEET.EMPTY_SUBTITLE' | translate }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fleet-page { max-width: 1100px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 700; }
    h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
    .btn-primary { padding: 10px 18px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .add-form { margin-bottom: 20px; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .form-group { }
    label { display: block; font-size: 13px; font-weight: 600; color: #424242; margin-bottom: 6px; }
    input, select { width: 100%; padding: 9px 12px; border: 1.5px solid #E0E0E0; border-radius: 8px; font-size: 14px; outline: none; background: white; }
    input:focus, select:focus { border-color: #FF6B35; }
    .form-actions { margin-top: 16px; }
    .vehicles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .vehicle-card { padding: 20px; }
    .vehicle-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .vehicle-plate { font-size: 18px; font-weight: 800; color: #1A1A2E; font-family: monospace; }
    .status-badge { padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #FFEBEE; color: #B71C1C; }
    .status-badge.active { background: #E8F5E9; color: #2E7D32; }
    .vehicle-name { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
    .vehicle-meta { display: flex; gap: 16px; font-size: 13px; color: #424242; margin-bottom: 8px; }
    .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .text-sm { font-size: 12px; } .text-muted { color: #757575; }
    .empty-state { grid-column: 1 / -1; text-align: center; padding: 48px; color: #757575; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; }
    .loading-overlay { text-align: center; padding: 40px; color: #757575; }
  `]
})
export class FleetComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  vehicles = signal<Vehicle[]>([]);
  vehicleTypes = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  submitting = signal(false);

  form = this.fb.group({
    registration_number: ['', Validators.required],
    make: ['', Validators.required],
    model: ['', Validators.required],
    year: [2020, [Validators.required, Validators.min(1980)]],
    payload_kg: [null as number | null, [Validators.required, Validators.min(100)]],
    vehicle_type: ['', Validators.required],
  });

  ngOnInit(): void {
    this.api.getVehicles().subscribe({ next: (r) => { this.vehicles.set(r.results); this.loading.set(false); }, error: () => this.loading.set(false) });
    this.api.getVehicleTypes().subscribe({ next: (t) => this.vehicleTypes.set(t) });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.api.createVehicle(this.form.value as any).subscribe({
      next: (v) => {
        this.vehicles.update(vs => [v, ...vs]);
        this.form.reset({ year: 2020 });
        this.showForm.set(false);
        this.submitting.set(false);
      },
      error: () => this.submitting.set(false),
    });
  }
}
