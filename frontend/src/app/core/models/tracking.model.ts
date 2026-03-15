export interface DriverLocation {
  driver_id: string;
  driver_name: string;
  lat: number;
  lng: number;
  speed: number | null;
  bearing: number | null;
  timestamp: string;
  is_available: boolean;
}

export interface GpsPing {
  lat: number;
  lng: number;
  speed?: number;
  bearing?: number;
  accuracy?: number;
}

export interface TrackingUpdate {
  type: 'location_update' | 'status_update' | 'arrival';
  data: DriverLocation;
}
