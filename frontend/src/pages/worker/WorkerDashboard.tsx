// ─── pages/worker/WorkerDashboard.tsx ────────────────────────────────────────
// • Online/offline toggle + GPS en tiempo real
// • Recibe solicitudes de viaje via WebSocket → modal aceptar/rechazar
// • Botón "Llegué al cliente" → status picked_up
// • Botón "Completar viaje"   → status completed
// • Notificaciones al cliente en cada cambio de estado

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/hooks/useStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Trip, TripRequest as TripRequestType, WorkerStats } from '@/types';
import TripRequestModal from './TripRequest';
import {
  Wifi, WifiOff, Power, MapPin, Navigation, Clock, DollarSign,
  Star, CheckCircle, AlertTriangle, Loader2, Bike, Phone,
  UserCheck, Flag,
} from 'lucide-react';

const DEFAULT_LAT  = parseFloat(import.meta.env.VITE_DEFAULT_LAT ?? '7.7622');
const DEFAULT_LNG  = parseFloat(import.meta.env.VITE_DEFAULT_LNG ?? '-76.6569');
const DEFAULT_CENTER: [number, number] = [DEFAULT_LAT, DEFAULT_LNG];

const WS_BASE = (import.meta.env.VITE_WS_URL ?? '').replace(/\/$/, '');
import { API_BASE as API } from "@/lib/apiConfig";

// ── Iconos ────────────────────────────────────────────────────────────────────
const MOTO_ICON = divIcon({
  html: `<div style="width:44px;height:44px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 2px 12px rgba(249,115,22,.5);display:flex;align-items:center;justify-content:center;font-size:22px;">🏍️</div>`,
  className: '', iconSize: [44, 44], iconAnchor: [22, 22],
});
const PICKUP_ICON = divIcon({
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(34,197,94,.4);display:flex;align-items:center;justify-content:center;font-size:16px;">📍</div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 18],
});
const DEST_ICON = divIcon({
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(239,68,68,.4);display:flex;align-items:center;justify-content:center;font-size:16px;">🏁</div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 18],
});

function MapCenter({ pos }: { pos: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.panTo(pos, { animate: true }); }, [pos, map]);
  return null;
}

function authH(token: string | null) {
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WorkerDashboard() {
  const { token, user } = useStore();

  const [isOnline,       setIsOnline]       = useState(false);
  const [position,       setPosition]       = useState<[number, number]>(DEFAULT_CENTER);
  const [activeTrip,     setActiveTrip]     = useState<Trip | null>(null);
  const [pendingRequest, setPendingRequest] = useState<TripRequestType | null>(null);
  const [stats,          setStats]          = useState<WorkerStats | null>(null);
  const [statsLoading,   setStatsLoading]   = useState(true);
  const [toggling,       setToggling]       = useState(false);
  const [statusLoading,  setStatusLoading]  = useState(false);
  const [statusMsg,      setStatusMsg]      = useState('');
  const watchIdRef = useRef<number | null>(null);

  const driverId = user?.driver_id ?? '';
  const wsUrl    = token && driverId && isOnline
    ? `${WS_BASE}/ws/location/${driverId}?token=${token}`
    : '';

  // ── Fetch stats ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setStatsLoading(true);
    fetch(`${API}/api/workers/me/stats`, { headers: authH(token) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); })
 .catch((e) => console.error('[WorkerDashboard] Error fetching stats:', e))
 .finally(() => setStatsLoading(false));
  }, [token]);

  // ── Fetch viaje activo al cargar ─────────────────────────────────────────
  useEffect(() => {
    if (!token || !driverId) return;
    fetch(`${API}/api/trips?status=assigned&driver_id_filter=${driverId}&limit=1`, { headers: authH(token) })
      .then(r => r.ok ? r.json() : [])
 .then((trips: Trip[]) => { if (trips[0]) setActiveTrip(trips[0]); })
 .catch((e) => console.error('[WorkerDashboard] Error fetching active trip:', e));
  }, [token, driverId]);

  // ── WebSocket messages ───────────────────────────────────────────────────
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      // Nueva solicitud de viaje entrante
      if (data.type === 'trip_request') {
        setPendingRequest(data.trip);
      }
      if (data.type === 'stats_update') setStats(data.stats);
 } catch (e) { console.warn('[WorkerDashboard] WS parse error:', e); }
 }, []);

  const { status: wsStatus, send } = useWebSocket({
    url: wsUrl, enabled: !!token && isOnline, onMessage: handleMessage,
  });

  // ── GPS watch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        if (wsStatus === 'connected') {
          send(JSON.stringify({
            latitude: coords[0], longitude: coords[1],
            bearing: 0, speed_kmh: 0, accuracy_m: pos.coords.accuracy ?? 10,
          }));
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 }
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isOnline, wsStatus, send]);

  // ── Toggle online ────────────────────────────────────────────────────────
  const toggleOnline = async () => {
    setToggling(true);
    try {
      const res = await fetch(`${API}/api/workers/me/status`, {
        method: 'PATCH',
        headers: authH(token),
        body: JSON.stringify({ is_online: !isOnline }),
      });
      if (res.ok) setIsOnline(prev => !prev);
    } catch {
      setIsOnline(prev => !prev); // optimistic
    } finally {
      setToggling(false);
    }
  };

  // ── Aceptar solicitud ────────────────────────────────────────────────────
  const handleAccept = async (tripId: string) => {
    setPendingRequest(null);
    try {
      const res = await fetch(`${API}/api/trips/${tripId}`, {
        headers: authH(token),
      });
 if (res.ok) setActiveTrip(await res.json());
 } catch (e) { console.error('[WorkerDashboard] Error accepting trip:', e); }
  };

  // ── Rechazar solicitud ───────────────────────────────────────────────────
  const handleReject = (_tripId: string) => {
    setPendingRequest(null);
    // El backend ya maneja la re-asignación a otro conductor
  };

  // ── Cambiar estado del viaje activo ─────────────────────────────────────
  const updateTripStatus = async (newStatus: string) => {
    if (!activeTrip) return;
    setStatusLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${API}/api/trips/${activeTrip.id}/status`, {
        method:  'PATCH',
        headers: authH(token),
        body:    JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = { ...activeTrip, status: newStatus };
        setActiveTrip(updated as Trip);
        if (newStatus === 'completed') {
          setStatusMsg('¡Viaje completado! El cliente fue notificado.');
          setTimeout(() => {
            setActiveTrip(null);
            setStatusMsg('');
            // Refrescar stats
            fetch(`${API}/api/workers/me/stats`, { headers: authH(token) })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setStats(d); });
          }, 2_000);
        }
        if (newStatus === 'picked_up') {
          setStatusMsg('✅ Cliente recogido — iniciando viaje');
          setTimeout(() => setStatusMsg(''), 2_000);
        }
      }
    } finally {
      setStatusLoading(false);
    }
  };

 const tripPickup: [number, number] | null = activeTrip
 ? activeTrip.pickup_location
 ? [activeTrip.pickup_location.lat, activeTrip.pickup_location.lng]
 : null
 : null;

 const tripDropoff: [number, number] | null = activeTrip
 ? activeTrip.dropoff_location
 ? [activeTrip.dropoff_location.lat, activeTrip.dropoff_location.lng]
 : null
 : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f8fafc]">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-[#0f172a] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#f97316] flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">{user?.full_name ?? 'Conductor'}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              {wsStatus === 'connected'
                ? <><Wifi className="w-3 h-3 text-green-400" />Conectado</>
                : <><WifiOff className="w-3 h-3 text-slate-500" />Sin conexión</>
              }
            </p>
          </div>
        </div>
        {/* Toggle online */}
        <button
          onClick={toggleOnline}
          disabled={toggling}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
            isOnline
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {toggling
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Power className="w-4 h-4" />
          }
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </div>

      {/* ── Mapa ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <MapContainer center={position} zoom={15} className="w-full h-full" zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapCenter pos={position} />
          <Marker position={position} icon={MOTO_ICON} />
          {tripPickup  && <Marker position={tripPickup}  icon={PICKUP_ICON} />}
          {tripDropoff && <Marker position={tripDropoff} icon={DEST_ICON}   />}
          {/* Ruta conductor → pickup */}
          {tripPickup && (
            <Polyline
              positions={[position, tripPickup]}
              pathOptions={{ color: '#22c55e', weight: 3, dashArray: '6 5', opacity: 0.8 }}
            />
          )}
          {/* Ruta pickup → destino */}
          {tripPickup && tripDropoff && activeTrip?.status === 'picked_up' && (
            <Polyline
              positions={[tripPickup, tripDropoff]}
              pathOptions={{ color: '#f97316', weight: 3, opacity: 0.8 }}
            />
          )}
        </MapContainer>

        {/* Indicador offline */}
        {!isOnline && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-[1000] pointer-events-none">
            <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-2xl text-center shadow-xl">
              <WifiOff className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Estás offline</p>
              <p className="text-xs text-slate-500">Activa el interruptor para recibir viajes</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Panel inferior ────────────────────────────────────────────── */}
      <div className="bg-white border-t border-slate-100 shadow-2xl flex-shrink-0">

        {/* ── Stats rápidas ── */}
        {!activeTrip && (
          <div className="grid grid-cols-3 gap-0 divide-x divide-slate-100 border-b border-slate-100">
            <StatBox
              icon={<DollarSign className="w-4 h-4 text-green-500" />}
              label="Hoy"
              value={statsLoading ? '…' : `$${((stats?.earnings_today ?? 0) / 1000).toFixed(0)}k`}
            />
            <StatBox
              icon={<Bike className="w-4 h-4 text-[#f97316]" />}
              label="Viajes"
              value={statsLoading ? '…' : String(stats?.trips_today ?? 0)}
            />
            <StatBox
              icon={<Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
              label="Rating"
              value={statsLoading ? '…' : (stats?.rating ?? 5.0).toFixed(1)}
            />
          </div>
        )}

        {/* ── Viaje activo ── */}
        {activeTrip && (
          <div className="px-4 py-4 space-y-3">
            {/* Info del viaje */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Viaje activo</p>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 font-medium line-clamp-1">{activeTrip.pickup_address}</p>
              </div>
              <div className="flex items-start gap-2">
                <Navigation className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 font-medium line-clamp-1">{activeTrip.dropoff_address}</p>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-500">👤 {activeTrip.passenger_name}</span>
                {activeTrip.passenger_phone && (
                  <a href={`tel:${activeTrip.passenger_phone}`} className="text-xs text-green-600 flex items-center gap-1 font-medium">
                    <Phone className="w-3 h-3" />{activeTrip.passenger_phone}
                  </a>
                )}
              </div>
            </div>

            {/* Mensaje de estado */}
            {statusMsg && (
              <p className="text-sm font-semibold text-green-600 text-center bg-green-50 rounded-xl py-2">
                {statusMsg}
              </p>
            )}

            {/* Botones de acción según estado */}
            <div className="space-y-2">
              {/* Estado: assigned → botón llegué al cliente */}
              {activeTrip.status === 'assigned' && (
                <button
                  onClick={() => updateTripStatus('picked_up')}
                  disabled={statusLoading}
                  className="w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-lg shadow-green-200 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {statusLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <UserCheck className="w-5 h-5" />
                  }
                  Llegué al cliente
                </button>
              )}

              {/* Estado: picked_up → botón completar viaje */}
              {(activeTrip.status === 'picked_up' || activeTrip.status === 'in_progress') && (
                <button
                  onClick={() => updateTripStatus('completed')}
                  disabled={statusLoading}
                  className="w-full py-3.5 rounded-2xl bg-[#f97316] hover:bg-[#ea580c] text-white font-black text-base flex items-center justify-center gap-2.5 shadow-lg shadow-orange-200 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {statusLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Flag className="w-5 h-5" />
                  }
                  Completar viaje
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sin viaje activo y online */}
        {!activeTrip && isOnline && (
          <div className="px-4 py-4 flex items-center justify-center gap-2 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-sm font-medium">Esperando solicitudes de viaje…</p>
          </div>
        )}

      </div>

      {/* ── Modal solicitud entrante ── */}
      {pendingRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end">
          <div className="w-full">
            <TripRequestModal
              request={pendingRequest}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat box ──────────────────────────────────────────────────────────────────
function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-3 gap-0.5">
      {icon}
      <p className="text-base font-black text-slate-800">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
