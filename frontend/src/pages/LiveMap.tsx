// ─── pages/LiveMap.tsx — Mapa en vivo (Admin) ────────────────────────────────
// • Conductores online en tiempo real (WebSocket)
// • Viajes pendientes: pickup + destino + ruta OSRM
// • Click en viaje → panel de asignación con conductores cercanos
// • Auto-asignar con un click

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  Polyline, useMap,
} from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/hooks/useStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  Bike, MapPin, Navigation, Users, Clock, Zap,
  RefreshCw, CheckCircle, AlertCircle, X,
} from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────
const API    = import.meta.env.VITE_API_URL ?? '';
const WS_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000').replace(/\/$/, '');
const CAREPA: [number, number] = [7.7622, -76.6569];

// ── Iconos ────────────────────────────────────────────────────────────────────
const DRIVER_ICON = (online: boolean) => divIcon({
  html: `<div style="width:38px;height:38px;border-radius:50%;background:${online ? '#0f172a' : '#64748b'};border:3px solid ${online ? '#f97316' : '#94a3b8'};box-shadow:0 2px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:18px;">🏍️</div>`,
  className: '', iconSize: [38, 38], iconAnchor: [19, 19],
});

const PICKUP_ICON = divIcon({
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(34,197,94,.5);display:flex;align-items:center;justify-content:center;font-size:15px;">📍</div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
});

const DROPOFF_ICON = divIcon({
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(239,68,68,.5);display:flex;align-items:center;justify-content:center;font-size:15px;">🏁</div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface DriverLoc {
  driver_id:   string;
  driver_name: string;
  latitude:    number;
  longitude:   number;
  bearing:     number;
  speed_kmh:   number;
  is_online:   boolean;
  trip_id:     string | null;
}

interface PendingTrip {
  id:              string;
  passenger_name:  string;
  passenger_phone: string;
  pickup_address:  string;
  dropoff_address: string;
  payment_method:  string;
  pickup_location:  { lat: number; lng: number } | null;
  dropoff_location: { lat: number; lng: number } | null;
  created_at:      string;
  route:           [number, number][] | null;   // polilínea OSRM
}

interface NearbyDriver {
  id:               string;
  full_name:        string;
  phone:            string;
  rating:           number;
  distance_meters:  number;
  current_location: { lat: number; lng: number };
}

// ── Hook: ruta OSRM ───────────────────────────────────────────────────────────
async function fetchRoute(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
): Promise<[number, number][]> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res  = await fetch(url);
    const data = await res.json();
    const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    return coords;
  } catch {
    // Fallback: línea recta
    return [[from.lat, from.lng], [to.lat, to.lng]];
  }
}

// ── Sub: mantener el mapa centrado ────────────────────────────────────────────
function SetView({ center }: { center: [number, number] }) {
  const map = useMap();
  const didSet = useRef(false);
  useEffect(() => {
    if (!didSet.current) { map.setView(center, 14); didSet.current = true; }
  }, [center, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LiveMap() {
  const { token } = useStore();

  const [drivers,      setDrivers]      = useState<Record<string, DriverLoc>>({});
  const [pendingTrips, setPendingTrips] = useState<PendingTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<PendingTrip | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [assigning,    setAssigning]    = useState(false);
  const [assignMsg,    setAssignMsg]    = useState('');
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [stats, setStats] = useState({ online: 0, pending: 0, assigned: 0 });

  const authH = useCallback(() =>
    token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
  [token]);

  // ── WebSocket admin ──────────────────────────────────────────────────────
  const wsUrl = token ? `${WS_BASE}/ws/admin/locations?token=${token}` : '';

  const handleWsMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'snapshot') {
        const map: Record<string, DriverLoc> = {};
        (msg.data as DriverLoc[]).forEach(d => { map[d.driver_id] = d; });
        setDrivers(map);
      }
      if (msg.type === 'location_update') {
        setDrivers(prev => ({ ...prev, [msg.data.driver_id]: msg.data }));
      }
      if (msg.type === 'driver_offline') {
        setDrivers(prev => {
          const next = { ...prev };
          if (next[msg.data.driver_id]) next[msg.data.driver_id].is_online = false;
          return next;
        });
      }
      // Cuando se asigna un viaje, refrescar la lista de pendientes
      if (msg.type === 'trip_update' && msg.trip?.status === 'assigned') {
        setPendingTrips(prev => prev.filter(t => t.id !== msg.trip.id));
        setSelectedTrip(sel => sel?.id === msg.trip.id ? null : sel);
      }
    } catch (_) {}
  }, []);

  const { status: wsStatus } = useWebSocket({
    url: wsUrl, enabled: !!token, onMessage: handleWsMessage,
  });

  // ── Cargar viajes pendientes ──────────────────────────────────────────────
  const loadPendingTrips = useCallback(async () => {
    if (!token) return;
    setLoadingTrips(true);
    try {
      const res  = await fetch(`${API}/api/trips?status=pending&limit=50`, { headers: authH() });
      const data: any[] = await res.json().catch(() => []);
      const trips: PendingTrip[] = data.map(t => ({
        id:               t.id,
        passenger_name:   t.passenger_name  ?? 'Sin nombre',
        passenger_phone:  t.passenger_phone ?? '',
        pickup_address:   t.pickup_address,
        dropoff_address:  t.dropoff_address,
        payment_method:   t.payment_method  ?? 'cash',
        pickup_location:  t.pickup_location  ?? null,
        dropoff_location: t.dropoff_location ?? null,
        created_at:       t.created_at,
        route:            null,
      }));
      // Obtener rutas en paralelo
      const tripsWithRoutes = await Promise.all(
        trips.map(async t => {
          if (t.pickup_location && t.dropoff_location) {
            t.route = await fetchRoute(t.pickup_location, t.dropoff_location);
          }
          return t;
        })
      );
      setPendingTrips(tripsWithRoutes);
    } finally {
      setLoadingTrips(false);
    }
  }, [token, authH]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const [locsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/locations`,              { headers: authH() }),
        fetch(`${API}/api/trips/stats/summary`,    { headers: authH() }),
      ]);
      const locs  = await locsRes.json().catch(() => ({ total_online: 0 }));
      const stats = await statsRes.json().catch(() => ({}));
      setStats({
        online:   locs.total_online ?? 0,
        pending:  stats.pending_trips ?? 0,
        assigned: stats.total_trips ?? 0,
      });
    } catch (_) {}
  }, [token, authH]);

  useEffect(() => { loadPendingTrips(); loadStats(); }, [loadPendingTrips, loadStats]);

  // ── Seleccionar viaje → buscar conductores cercanos ───────────────────────
  const handleSelectTrip = async (trip: PendingTrip) => {
    setSelectedTrip(trip);
    setAssignMsg('');
    if (!trip.pickup_location) return;
    setLoadingNearby(true);
    try {
      const res = await fetch(`${API}/api/dispatch/nearby`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({
          latitude:  trip.pickup_location.lat,
          longitude: trip.pickup_location.lng,
          radius_km: 5,
          limit:     8,
        }),
      });
      setNearbyDrivers(await res.json().catch(() => []));
    } finally {
      setLoadingNearby(false);
    }
  };

  // ── Asignar manualmente ───────────────────────────────────────────────────
  const handleAssign = async (driverId: string) => {
    if (!selectedTrip) return;
    setAssigning(true);
    setAssignMsg('');
    try {
      const res = await fetch(
        `${API}/api/dispatch/assign?trip_id=${selectedTrip.id}&driver_id=${driverId}`,
        { method: 'POST', headers: authH() }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAssignMsg(`✅ Asignado a ${data.driver_name}`);
        setPendingTrips(prev => prev.filter(t => t.id !== selectedTrip.id));
        setTimeout(() => { setSelectedTrip(null); setAssignMsg(''); }, 1500);
      } else {
        setAssignMsg(`❌ ${data.detail ?? 'Error al asignar'}`);
      }
    } finally {
      setAssigning(false);
    }
  };

  // ── Auto-asignar ──────────────────────────────────────────────────────────
  const handleAutoAssign = async () => {
    if (!selectedTrip) return;
    setAssigning(true);
    setAssignMsg('');
    try {
      const res = await fetch(
        `${API}/api/dispatch/auto?trip_id=${selectedTrip.id}`,
        { method: 'POST', headers: authH() }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAssignMsg(`✅ Auto-asignado a ${data.driver_name}`);
        setPendingTrips(prev => prev.filter(t => t.id !== selectedTrip.id));
        setTimeout(() => { setSelectedTrip(null); setAssignMsg(''); }, 1500);
      } else {
        setAssignMsg(`❌ ${data.detail ?? 'Error'}`);
      }
    } finally {
      setAssigning(false);
    }
  };

  const driverList  = Object.values(drivers);
  const onlineCount = driverList.filter(d => d.is_online).length;

  return (
    <div className="h-full flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-black text-slate-800 text-lg">Mapa en Vivo</h1>
          {/* Stats pills */}
          <div className="flex gap-2">
            <Pill icon={<Bike className="w-3.5 h-3.5"/>} label={`${onlineCount} online`} color="green" />
            <Pill icon={<Clock className="w-3.5 h-3.5"/>} label={`${pendingTrips.length} pendientes`} color="orange" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* WS status */}
          <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-xs text-slate-400">{wsStatus === 'connected' ? 'En vivo' : 'Reconectando…'}</span>
          <button
            onClick={() => { loadPendingTrips(); loadStats(); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loadingTrips ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar izquierdo — viajes pendientes ── */}
        <div className="w-72 bg-white border-r border-slate-100 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Viajes Pendientes ({pendingTrips.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingTrips && (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
            {!loadingTrips && pendingTrips.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <CheckCircle className="w-8 h-8 mb-2 text-green-300" />
                <p className="text-sm font-medium">Sin viajes pendientes</p>
              </div>
            )}
            {pendingTrips.map(trip => (
              <button
                key={trip.id}
                onClick={() => handleSelectTrip(trip)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-orange-50 transition-colors ${
                  selectedTrip?.id === trip.id ? 'bg-orange-50 border-l-4 border-l-[#f97316]' : ''
                }`}
              >
                <p className="font-semibold text-slate-800 text-sm truncate">
                  {trip.passenger_name}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 text-green-500 flex-shrink-0" />
                  {trip.pickup_address}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                  <Navigation className="w-3 h-3 text-red-400 flex-shrink-0" />
                  {trip.dropoff_address}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(trip.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {trip.payment_method === 'cash' ? '💵' : trip.payment_method === 'nequi' ? '📱' : '💳'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Mapa ── */}
        <div className="flex-1 relative">
          <MapContainer center={CAREPA} zoom={14} className="w-full h-full" zoomControl={true}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <SetView center={CAREPA} />

            {/* Conductores */}
            {driverList.map(d => (
              <Marker
                key={d.driver_id}
                position={[d.latitude, d.longitude]}
                icon={DRIVER_ICON(d.is_online)}
              >
                <Popup>
                  <div className="text-sm font-semibold">{d.driver_name}</div>
                  <div className="text-xs text-slate-500">
                    {d.is_online ? '🟢 Online' : '⚫ Offline'}
                    {d.trip_id && ' · En viaje'}
                  </div>
                  {d.speed_kmh > 0 && (
                    <div className="text-xs text-slate-400">{d.speed_kmh.toFixed(0)} km/h</div>
                  )}
                </Popup>
              </Marker>
            ))}

            {/* Viajes pendientes */}
            {pendingTrips.map(trip => (
              <TripMarkers
                key={trip.id}
                trip={trip}
                isSelected={selectedTrip?.id === trip.id}
                onClick={() => handleSelectTrip(trip)}
              />
            ))}
          </MapContainer>

          {/* ── Panel de asignación (flotante) ── */}
          {selectedTrip && (
            <div className="absolute top-4 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] overflow-hidden">
              <div className="bg-[#0f172a] px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">{selectedTrip.passenger_name}</p>
                  <p className="text-slate-400 text-xs">{selectedTrip.passenger_phone}</p>
                </div>
                <button onClick={() => setSelectedTrip(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 py-3 space-y-1.5 border-b border-slate-100">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  {selectedTrip.pickup_address}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  {selectedTrip.dropoff_address}
                </p>
              </div>

              {/* Auto-asignar */}
              <div className="px-4 py-3 border-b border-slate-100">
                <button
                  onClick={handleAutoAssign}
                  disabled={assigning}
                  className="w-full py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {assigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Auto-asignar al más cercano
                </button>
                {assignMsg && (
                  <p className={`text-xs mt-2 font-medium text-center ${assignMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                    {assignMsg}
                  </p>
                )}
              </div>

              {/* Lista conductores cercanos */}
              <div className="max-h-56 overflow-y-auto">
                {loadingNearby && (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                    <span className="text-xs text-slate-400 ml-2">Buscando conductores…</span>
                  </div>
                )}
                {!loadingNearby && nearbyDrivers.length === 0 && (
                  <div className="flex items-center justify-center py-6">
                    <AlertCircle className="w-4 h-4 text-slate-300 mr-2" />
                    <span className="text-xs text-slate-400">Sin conductores en 5 km</span>
                  </div>
                )}
                {nearbyDrivers.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleAssign(d.id)}
                    disabled={assigning}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#0f172a] flex items-center justify-center text-sm flex-shrink-0">🏍️</div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-slate-800">{d.full_name}</p>
                      <p className="text-xs text-slate-400">
                        ⭐ {d.rating.toFixed(1)} · {(d.distance_meters / 1000).toFixed(1)} km
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#f97316]">Asignar</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Markers de un viaje (pickup + dropoff + ruta) ─────────────────────────────
function TripMarkers({
  trip, isSelected, onClick,
}: { trip: PendingTrip; isSelected: boolean; onClick: () => void }) {
  return (
    <>
      {trip.route && (
        <Polyline
          positions={trip.route}
          pathOptions={{ color: isSelected ? '#f97316' : '#94a3b8', weight: isSelected ? 4 : 2, opacity: isSelected ? 0.9 : 0.5 }}
          eventHandlers={{ click: onClick }}
        />
      )}
      {trip.pickup_location && (
        <Marker position={[trip.pickup_location.lat, trip.pickup_location.lng]} icon={PICKUP_ICON}
          eventHandlers={{ click: onClick }}>
          <Popup>
            <p className="font-semibold text-sm">{trip.passenger_name}</p>
            <p className="text-xs text-slate-500">📍 {trip.pickup_address}</p>
          </Popup>
        </Marker>
      )}
      {trip.dropoff_location && (
        <Marker position={[trip.dropoff_location.lat, trip.dropoff_location.lng]} icon={DROPOFF_ICON}
          eventHandlers={{ click: onClick }}>
          <Popup>
            <p className="text-xs text-slate-500">🏁 {trip.dropoff_address}</p>
          </Popup>
        </Marker>
      )}
    </>
  );
}

// ── Pill helper ───────────────────────────────────────────────────────────────
function Pill({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-50  text-green-700  border-green-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    blue:   'bg-blue-50   text-blue-700   border-blue-100',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[color] ?? colors.blue}`}>
      {icon}{label}
    </span>
  );
}
