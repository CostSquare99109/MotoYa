// ─── pages/client/ClientHome.tsx ─────────────────────────────────────────────
// • Recogida = ubicación actual del GPS (no editable en el mapa)
// • Destino  = tap en el mapa
// • Método de pago + estimado de tarifa
// • "Solicitar Moto" → auto-despacho al conductor más cercano disponible

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { divIcon, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router';
import { useStore } from '@/hooks/useStore';
import {
  Navigation, DollarSign, Loader2, Bike, CreditCard,
  Smartphone, Banknote, LogOut, MapPin, CheckCircle2,
  RefreshCw,
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────
const CAREPA: [number, number] = [7.7622, -76.6569];
const FARE_PER_KM = 2_500;
const BASE_FARE   = 4_000;

const PAYMENT_OPTIONS = [
  { id: 'cash',      label: 'Efectivo',  icon: Banknote,   color: '#22c55e' },
  { id: 'nequi',     label: 'Nequi',     icon: Smartphone, color: '#7c3aed' },
  { id: 'daviplata', label: 'Daviplata', icon: Smartphone, color: '#f97316' },
  { id: 'card',      label: 'Tarjeta',   icon: CreditCard, color: '#0ea5e9' },
];

// ── Iconos del mapa ───────────────────────────────────────────────────────────
const PICKUP_ICON = divIcon({
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 12px rgba(34,197,94,.5);display:flex;align-items:center;justify-content:center;font-size:16px;">📍</div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 18],
});

const DROPOFF_ICON = divIcon({
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 2px 12px rgba(249,115,22,.5);display:flex;align-items:center;justify-content:center;font-size:16px;">🏁</div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 18],
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function haversine([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Sub-componentes del mapa ──────────────────────────────────────────────────

/** Centra el mapa en unas coordenadas cuando estas cambian */
function MapCenterSync({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 15, { animate: true }); }, [center, map]);
  return null;
}

/** Captura clicks del mapa → establece destino */
function DestinationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ClientHome() {
  const navigate = useNavigate();
  const { user, token, logout } = useStore();

  // Coordenadas guardadas en el store desde el login (si el GPS funcionó)
  const savedCoords = user?.coords as { lat: number; lng: number } | undefined;

  const [pickup,      setPickup]      = useState<[number, number] | null>(
    savedCoords ? [savedCoords.lat, savedCoords.lng] : null
  );
  const [dropoff,     setDropoff]     = useState<[number, number] | null>(null);
  const [dropoffAddr, setDropoffAddr] = useState('');
  const [payment,     setPayment]     = useState<string>('cash');
  const [requesting,  setRequesting]  = useState(false);
  const [gpsLoading,  setGpsLoading]  = useState(!savedCoords);
  const [hint,        setHint]        = useState(!savedCoords
    ? 'Obteniendo tu ubicación…'
    : 'Toca el mapa para elegir destino');

  const mapCenter: [number, number] = pickup ?? CAREPA;
  const distance = pickup && dropoff ? haversine(pickup, dropoff) : 0;
  const fare     = pickup && dropoff ? Math.round(BASE_FARE + distance * FARE_PER_KM) : 0;

  // ── Auto-GPS al montar (si no viene del login) ────────────────────────────
  useEffect(() => {
    if (savedCoords) return; // ya tenemos coords del login
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setPickup([pos.coords.latitude, pos.coords.longitude]);
        setGpsLoading(false);
        setHint('Toca el mapa para elegir destino');
      },
      () => {
        setGpsLoading(false);
        setHint('GPS no disponible — usa el botón ↻ para reintentar');
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [savedCoords]);

  // ── Re-obtener GPS manualmente ────────────────────────────────────────────
  const refreshLocation = () => {
    setGpsLoading(true);
    setHint('Obteniendo tu ubicación…');
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setPickup([pos.coords.latitude, pos.coords.longitude]);
        setGpsLoading(false);
        setHint('Toca el mapa para elegir destino');
      },
      () => {
        setGpsLoading(false);
        setHint('No se pudo obtener la ubicación');
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  // ── Click en el mapa → destino ────────────────────────────────────────────
  const handleMapClick = (lat: number, lng: number) => {
    setDropoff([lat, lng]);
    setDropoffAddr(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setHint('Destino establecido — elige método de pago y solicita');
  };

  // ── Solicitar moto ────────────────────────────────────────────────────────
  const handleRequest = async () => {
    if (!pickup || !dropoff) return;
    setRequesting(true);
    try {
      const res = await fetch('/api/trips/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          passenger_name:   user?.full_name ?? 'Pasajero',
          passenger_phone:  user?.phone     ?? '',
          pickup_lat:       pickup[0],
          pickup_lng:       pickup[1],
          pickup_address:   'Mi ubicación actual',
          dropoff_lat:      dropoff[0],
          dropoff_lng:      dropoff[1],
          dropoff_address:  dropoffAddr,
          payment_method:   payment,
        }),
      });
 const data = await res.json();
 if (!data.id) throw new Error('No trip ID returned');
 navigate(`/client/track/${data.id}`);
 } catch (err) {
 // Show error instead of navigating to fake demo trip
 alert('Error al solicitar viaje. Intenta de nuevo.');
 } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f8fafc]">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center shadow-md">
            <Bike className="w-5 h-5 text-[#f97316]" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-none">
              {user?.full_name?.split(' ')[0] ?? 'MotoYa'}
            </p>
            <p className="text-xs text-slate-400">Pasajero</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Re-obtener GPS */}
          <button
            onClick={refreshLocation}
            disabled={gpsLoading}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50"
            title="Actualizar ubicación"
          >
            <RefreshCw className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { logout(); navigate('/client/login'); }}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
            title="Salir"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Mapa ── */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={15}
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapCenterSync center={mapCenter} />
          <DestinationPicker onPick={handleMapClick} />
          {pickup  && <Marker position={pickup}  icon={PICKUP_ICON}  />}
          {dropoff && <Marker position={dropoff} icon={DROPOFF_ICON} />}
        </MapContainer>

        {/* Pista contextual flotante */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-100 text-xs font-semibold text-slate-600 max-w-[80%] text-center pointer-events-none">
          {gpsLoading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-[#f97316]" />
              Obteniendo tu ubicación…
            </span>
          ) : hint}
        </div>
      </div>

      {/* ── Panel inferior ── */}
      <div className="bg-white border-t border-slate-100 shadow-2xl shadow-slate-200/80">
        <div className="px-4 pt-4 pb-5 space-y-4">

          {/* ── Origen / Destino ── */}
          <div className="space-y-2">
            {/* Origen (solo lectura) */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-green-50 border-2 border-green-200">
              <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm text-slate-700 font-medium truncate flex-1">
                {pickup ? 'Mi ubicación actual' : 'Esperando GPS…'}
              </span>
              {pickup && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
            </div>
            {/* Destino */}
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                dropoff
                  ? 'border-[#f97316] bg-orange-50'
                  : 'border-dashed border-slate-200 bg-slate-50 hover:border-[#f97316]'
              }`}
              onClick={() => setHint('Toca el mapa para mover el destino')}
            >
              <Navigation className="w-4 h-4 text-[#f97316] flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate flex-1">
                {dropoffAddr || 'Toca el mapa para elegir destino'}
              </span>
              {dropoff && <CheckCircle2 className="w-4 h-4 text-[#f97316] flex-shrink-0" />}
            </div>
          </div>

          {/* ── Métodos de pago ── */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {PAYMENT_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = payment === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setPayment(opt.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border-2 transition-all ${
                    active
                      ? 'text-white border-transparent'
                      : 'border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}
                  style={active ? { background: opt.color, borderColor: opt.color } : {}}
                >
                  <Icon className="w-3.5 h-3.5" />{opt.label}
                </button>
              );
            })}
          </div>

          {/* ── Tarifa + botón solicitar ── */}
          <div className="flex items-center gap-3">
            {fare > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2.5 bg-green-50 rounded-xl border border-green-100">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm font-black text-green-700">
                  ${fare.toLocaleString('es-CO')}
                </span>
                <span className="text-xs text-green-500">· {distance.toFixed(1)}km</span>
              </div>
            )}
            <button
              onClick={handleRequest}
              disabled={!pickup || !dropoff || requesting}
              className="flex-1 h-13 py-3.5 rounded-2xl bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.98] text-white font-black text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-lg shadow-orange-300/40"
            >
              {requesting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Buscando conductor…
                </>
              ) : (
                <>
                  <Bike className="w-5 h-5" />
                  Solicitar Moto
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
