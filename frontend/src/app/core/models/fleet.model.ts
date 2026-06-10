export interface VehicleType {
  id: string;
  name: string;
  code: string;
  max_payload_kg: number;
  max_volume_m3: number | null;
  description: string;
}

export interface Vehicle {
  id: string;
  registration_number: string;
  vin?: string;
  make: string;
  model: string;
  year: number;
  vehicle_type: string;
  vehicle_type_name?: string;
  trailer_type?: string;
  owner: string;
  owner_name?: string;
  payload_kg: number;
  gross_weight_kg?: number;
  axle_count?: number;
  registration_expiry?: string;
  is_active: boolean;
  created_at: string;
}

export interface VehicleDocument {
  id: string;
  vehicle: string;
  doc_type: 'CARTE_GRISE' | 'INSURANCE' | 'INSPECTION' | 'OTHER';
  file: string;
  expiry_date: string | null;
  is_valid: boolean;
}
