export type OrderStatus =
  | 'DRAFT' | 'POSTED' | 'BIDDING' | 'ASSIGNED'
  | 'PICKUP_PENDING' | 'PICKED_UP' | 'IN_TRANSIT'
  | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

export type CargoType =
  | 'GENERAL' | 'REFRIGERATED' | 'HAZARDOUS' | 'LIVESTOCK'
  | 'BULK' | 'CONSTRUCTION' | 'ELECTRONICS';

export interface UserBasic {
  id: string;
  full_name: string;
  phone_number: string;
  role: string;
  is_verified: boolean;
}

export interface SuggestedPrice {
  straight_distance_km: number;
  road_distance_km: number;
  base_price_xof: number;
  min_price_xof: number;
  max_price_xof: number;
}

export interface FreightOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  shipper: string;
  shipper_detail?: UserBasic;
  cargo_type: CargoType;
  cargo_description: string;
  weight_kg: number;
  volume_m3: number | null;
  pickup_address: string;
  pickup_city: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_city: string;
  delivery_lat: number;
  delivery_lng: number;
  pickup_scheduled_at: string;
  delivery_deadline: string | null;
  proposed_price: number | null;
  final_price: number | null;
  currency: string;
  special_instructions: string;
  estimated_distance_km: number | null;
  suggested_price: SuggestedPrice | null;
  created_at: string;
  updated_at: string;
  assignment?: OrderAssignment;
  bid_count?: number;
  can_bid?: boolean;
}

export interface OrderBid {
  id: string;
  order: string;
  carrier: string;
  carrier_detail: UserBasic;
  vehicle: string | null;
  price: number;
  estimated_pickup_time: string | null;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}

export interface OrderAssignment {
  id: string;
  driver: string;
  driver_detail: UserBasic;
  vehicle: string | null;
  assigned_at: string;
  picked_up_at: string | null;
  in_transit_at: string | null;
  delivered_at: string | null;
  pickup_proof_photo: string | null;
  pickup_proof_note: string;
  proof_photo: string | null;
  proof_note: string;
  proof_signature: string | null;
  delivery_confirmed_by_shipper: boolean;
  shipper_rating: number | null;
  driver_rating: number | null;
}

export interface CreateOrderPayload {
  cargo_type: CargoType;
  cargo_description: string;
  weight_kg: number;
  volume_m3?: number;
  pickup_address: string;
  pickup_city: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_city: string;
  delivery_lat: number;
  delivery_lng: number;
  pickup_scheduled_at: string;
  delivery_deadline?: string;
  proposed_price?: number;
  special_instructions?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
