// ─── pages/client/TrackTrip.tsx ──────────────────────────────────────────────
// • Muestra la posición del conductor en tiempo real
// • Recibe cambios de estado del viaje vía WebSocket
// • Botón "Ya llegué" → confirma llegada + calificar al conductor

import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/hooks/useStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  Phone, Star, Navigation, MapPin, Clock,
  Bike, CheckCircle, Loader2, ThumbsUp,
} from 'lucide-react';

const API     = import.meta.env.VITE_API_URL  ?? '';
const WS_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000').replace(/\/$/, '');
const CAREPA: [number, number] = [7.7622, -76.6569];

// ── Estados del viaje ────────────────────────────────────────────────────────
const STATUS_STEPS = ['pending', 'assigned', 'picked_up', 'in_progress', 'completed'] as const;
const STATUS_LABELS: Record<string, string> = {
  pending:     '🔍 Buscando conductor…',
  assigned:    '🏍️ Conductor en camino',
  picked_up:   '🚀 ¡A bordo! En camino al destino',
  in_progress: '📍 En camino al destino',
  completed:   '🎉 ¡Llegaste!',
  cancelled:   '❌ Viaje cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-800',
  assigned:    'bg-blue-100   text-blue-800',
  picked_up:   'bg-purple-100 text-purple-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed:   'bg-green-100  text-green-800',
  cancelled:   'bg-red-100    text-red-800',
};

// ── Iconos ───────────────────────────────────────────────────────────────────
const DRIVER_ICON = divIcon({
  html: `<div style="width:44px;height:44px;border-radius:50%;background:#0f172a;border:3px solid #f97316;box-shadow:0 2px 14px rgba(249,115,22,.4);display:flex;align-items:center;justify-content:center;font-size:20px;">🏍️</div>`,
  className: '', iconSize: [44, 44], iconAnchor: [22, 22],
});
const PICKUP_ICON = divIcon({
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#22c55e;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:15px;">📍</div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
});

function MapRecenter({ pos }: { pos: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.panTo(pos, { animate: true }); }, [pos, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TrackTrip() {
  const { tripId }  = useParams<{ tripId: string }>();
  const navigate    = useNavigate();
  const { token, user } = useStore();

  const [status,    setStatus]    = useState('pending');
  const [driver,    setDriver]    = useState<{ full_name: string; phone: string; rating: number } | null>(null);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [myPos,     setMyPos]     = useState<[number, number]>(CAREPA);
  const [eta,       setEta]       = useState<number | null>(null);
  const [rating,    setRating]    = useState(0);
  const [hovered,   setHovered]   = useState(0);
  const [rated,     setRated]     = useState(false);
  const [comment,   setComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Obtener posición del cliente
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setMyPos([pos.coords.latitude, pos.coords.longitude]);
    });
  }, []);

  // ── WebSocket tracking ───────────────────────────────────────────────────
  const wsUrl = token && tripId
    ? `${WS_BASE}/ws/trip/${tripId}/track?token=${token}`
    : '';

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'trip_update') {
        const trip = msg.trip;
        if (trip.status) setStatus(trip.status);
        if (trip.driver) setDriver(trip.driver);
      }

      if (msg.type === 'location_update') {
        const d = msg.data;
        if (d.latitude && d.longitude) {
          setDriverPos([d.latitude, d.longitude]);
        }
      }

      if (msg.type === 'eta_update') {
        setEta(msg.minutes);
      }
    } catch (_) {}
  }, []);

  const { status: wsStatus } = useWebSocket({
    url: wsUrl, enabled: !!token && !!tripId, onMessage: handleMessage,
  });

  // Polling fallback (cada 8s) para status si no hay WS
  useEffect(() => {
    if (wsStatus === 'connected' || !token || !tripId) return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/api/trips/${tripId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status) setStatus(data.status);
        if (data.driver) setDriver(data.driver);
      } catch (_) {}
    }, 8_000);
    return () => clearInterval(interval);
  }, [wsStatus, token, tripId]);

  // ── Calificar ────────────────────────────────────────────────────────────
  const handleRate = async () => {
    if (!rating || !tripId) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/api/trips/${tripId}/status`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rating }),
      });
      setRated(true);
    } finally {
      setSubmitting(false);
    }
  };

  const currentStepIdx = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f8fafc]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-[#0f172a] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#f97316] flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">Rastreando viaje</p>
            <p className="text-slate-400 text-xs">
              {wsStatus === 'connected' ? '🟢 En vivo' : '🟡 Reconectando…'}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {/* ── Mapa ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <MapContainer center={driverPos ?? myPos} zoom={15} className="w-full h-full" zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {driverPos && <MapRecenter pos={driverPos} />}
          {driverPos && <Marker position={driverPos} icon={DRIVER_ICON} />}
          <Marker position={myPos} icon={PICKUP_ICON} />
          {driverPos && (
            <Polyline
              positions={[driverPos, myPos]}
              pathOptions={{ color: '#f97316', weight: 3, dashArray: '8 6', opacity: 0.8 }}
            />
          )}
        </MapContainer>

        {/* ETA flotante */}
        {eta && status !== 'completed' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-slate-100 text-sm font-bold text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#f97316]" />
            {eta} min estimados
          </div>
        )}
      </div>

      {/* ── Panel inferior ────────────────────────────────────────────── */}
      <div className="bg-white border-t border-slate-100 shadow-2xl flex-shrink-0">

        {/* Barra de progreso de estados */}
        {status !== 'completed' && status !== 'cancelled' && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-1">
              {STATUS_STEPS.map((s, i) => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${
                  i <= currentStepIdx ? 'bg-[#f97316]' : 'bg-slate-100'
                }`} />
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 font-medium text-center">
              {STATUS_LABELS[status]}
            </p>
          </div>
        )}

        {/* Info del conductor */}
        {driver && status !== 'completed' && (
          <div className="px-4 py-3 flex items-center gap-3 border-t border-slate-50">
            <div className="w-11 h-11 rounded-full bg-[#0f172a] flex items-center justify-center text-xl flex-shrink-0">🏍️</div>
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-sm">{driver.full_name}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                {driver.rating.toFixed(1)} · Tu conductor
              </p>
            </div>
            {driver.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors"
              >
                <Phone className="w-4.5 h-4.5 text-green-600" />
              </a>
            )}
          </div>
        )}

        {/* ── Completado: calificar ── */}
        {status === 'completed' && !rated && (
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <p className="font-bold text-base">¡Llegaste! ¿Cómo estuvo el viaje?</p>
            </div>
            <div className="flex gap-1.5 justify-center py-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star className={`w-9 h-9 transition-colors ${
                    n <= (hovered || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-slate-200'
                  }`} />
                </button>
              ))}
            </div>
            <textarea
              placeholder="Comentario opcional…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:border-[#f97316] resize-none"
            />
            <button
              onClick={handleRate}
              disabled={!rating || submitting}
              className="w-full py-3 rounded-2xl bg-[#f97316] hover:bg-[#ea580c] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
              Enviar calificación
            </button>
          </div>
        )}

        {/* Post-calificación */}
        {rated && (
          <div className="px-4 py-5 flex flex-col items-center gap-3">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-bold text-slate-800">¡Gracias por tu calificación!</p>
            <button
              onClick={() => navigate('/client')}
              className="px-6 py-2.5 rounded-xl bg-[#0f172a] text-white font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              Pedir otro viaje
            </button>
          </div>
        )}

        {/* Cancelado */}
        {status === 'cancelled' && (
          <div className="px-4 py-4 flex flex-col items-center gap-3">
            <p className="text-red-500 font-bold">Viaje cancelado</p>
            <button
              onClick={() => navigate('/client')}
              className="px-6 py-2.5 rounded-xl bg-[#f97316] text-white font-bold text-sm"
            >
              Volver al inicio
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
