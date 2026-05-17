// ─── Auth & Roles ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'worker' | 'client';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  full_name: string;
  role: UserRole;
  profile_photo_url?: string;
}

// ─── Driver / Worker ──────────────────────────────────────────────────────────

export interface Driver {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  document_id: string;
  license_number: string;
  license_expiry: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  is_online: boolean;
  rating: number;
  total_trips: number;
  profile_photo_url?: string;
  current_location?: { lat: number; lng: number };
  last_seen?: string;
  created_at: string;
}

export interface WorkerStats {
  trips_today: number;
  earnings_today: number;
  earnings_week: number;
  earnings_month: number;
  rating: number;
  total_trips: number;
  acceptance_rate: number;
  level: number;
  points: number;
  badges: string[];
}

export interface WorkerLevel {
  level: number;
  name: string;
  min_points: number;
  max_points: number;
  color: string;
  perks: string[];
}

// ─── Client / Passenger ───────────────────────────────────────────────────────

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  profile_photo_url?: string;
  rating: number;
  total_trips: number;
  created_at: string;
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

export interface Trip {
  id: string;
  driver_id?: string;
  client_id?: string;
  passenger_name?: string;
  passenger_phone?: string;
  driver?: Driver;
  pickup_address: string;
  dropoff_address: string;
  pickup_location?: { lat: number; lng: number };
  dropoff_location?: { lat: number; lng: number };
  status: 'pending' | 'assigned' | 'picked_up' | 'in_progress' | 'completed' | 'cancelled';
  fare?: number;
  commission?: number;
  distance_km?: number;
  duration_min?: number;
  payment_method: 'cash' | 'card' | 'nequi' | 'daviplata';
  rating?: number;
  rating_comment?: string;
  notes?: string;
  created_at: string;
  accepted_at?: string;
  completed_at?: string;
}

export interface TripRequest {
  id: string;
  passenger_name: string;
  passenger_phone: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  distance_km: number;
  estimated_fare: number;
  payment_method: 'cash' | 'card' | 'nequi' | 'daviplata';
  expires_at: string; // ISO — 30 s from creation
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface NearbyDriver {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  is_online: boolean;
  rating: number;
  distance_meters: number;
  current_location: { lat: number; lng: number };
}

export interface TripStats {
  total_trips: number;
  pending_trips: number;
  completed_today: number;
  cancelled_today: number;
  avg_fare: number;
  total_revenue_today: number;
}

export interface FinanceSummary {
  total_gross: number;
  total_commissions: number;
  total_fuel: number;
  total_net: number;
  trip_count: number;
  avg_per_trip: number;
  period: string;
}

export interface RankingEntry {
  rank: number;
  driver_id: string;
  driver_name: string;
  tier: string;
  points: number;
  monthly_trips: number;
  rating_avg: number;
  badges: string[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// ─── Map ──────────────────────────────────────────────────────────────────────

export interface HeatmapData {
  demand_zones: { lat: number; lng: number; intensity: number }[];
  active_drivers: { lat: number; lng: number }[];
  total_pending: number;
  total_active: number;
}

// ─── System ───────────────────────────────────────────────────────────────────

export interface Emergency {
  id: string;
  driver_id: string;
  type: string;
  location?: { lat: number; lng: number };
  status: string;
  created_at: string;
}

export interface NavItem {
  label: string;
  icon: string;
  path: string;
}

// ─── Users (backoffice) ───────────────────────────────────────────────────────

export interface User {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending';
  profile_photo_url?: string;
  created_at: string;
  last_login?: string;
}
