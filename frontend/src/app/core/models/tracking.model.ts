export interface DriverLocation {
  driver_id: string;
  driver_name: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading: number | null;
  accuracy_m: number | null;
  timestamp: string;
  order_id?: string;
  is_available: boolean;
}

export interface GpsPing {
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  heading?: number;
  accuracy_m?: number;
}

export interface TrackingUpdate {
  type: 'location_update' | 'status_update' | 'arrival';
  data: DriverLocation;
}
