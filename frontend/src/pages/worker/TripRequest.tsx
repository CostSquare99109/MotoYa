import { useEffect, useState, useRef } from 'react';
import type { TripRequest } from '@/types';
import { MapPin, Clock, DollarSign, Navigation, Smartphone, Check, X } from 'lucide-react';

const PAYMENT_LABELS: Record<string, string> = {
  cash:      '💵 Efectivo',
  card:      '💳 Tarjeta',
  nequi:     '📱 Nequi',
  daviplata: '📱 Daviplata',
};

const COUNTDOWN_SECONDS = 30;

interface TripRequestModalProps {
  request: TripRequest;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export default function TripRequestModal({ request, onAccept, onReject }: TripRequestModalProps) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [decision, setDecision] = useState<'accepted' | 'rejected' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onReject(request.id); // Auto-reject on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [request.id, onReject]);

  const handleAccept = () => {
    clearInterval(intervalRef.current!);
    setDecision('accepted');
    setTimeout(() => onAccept(request.id), 600);
  };

  const handleReject = () => {
    clearInterval(intervalRef.current!);
    setDecision('rejected');
    setTimeout(() => onReject(request.id), 400);
  };

  const pct = (seconds / COUNTDOWN_SECONDS) * 100;
  const circumference = 2 * Math.PI * 28; // r=28
  const strokeDashoffset = circumference * (1 - pct / 100);
  const ringColor = seconds > 15 ? '#f97316' : seconds > 7 ? '#eab308' : '#ef4444';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div
        className={`relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ${
          decision === 'accepted' ? 'scale-95 opacity-0' :
          decision === 'rejected' ? 'scale-105 opacity-0' :
          'scale-100 opacity-100'
        }`}
        style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)' }}
      >
        {/* Top pulse bar */}
        <div className="h-1 w-full bg-slate-700 overflow-hidden">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%`, background: ringColor }}
          />
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">¡Nuevo viaje!</h2>
              <p className="text-sm text-slate-400">{request.passenger_name}</p>
            </div>

            {/* Countdown ring */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#1e293b" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none"
                  stroke={ringColor} strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
                <span className="text-base font-bold text-white leading-none">{seconds}</span>
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="bg-white/5 rounded-xl p-4 space-y-3 mb-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Recogida</p>
                <p className="text-sm font-medium text-white">{request.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pl-2">
              <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-[#f97316] rounded-full ml-2" />
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-[#f97316] flex items-center justify-center flex-shrink-0">
                <Navigation className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Destino</p>
                <p className="text-sm font-medium text-white">{request.dropoff_address}</p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-white/5 rounded-lg p-2.5 text-center">
              <Navigation className="w-4 h-4 text-[#f97316] mx-auto mb-1" />
              <p className="text-xs text-slate-400">Distancia</p>
              <p className="text-sm font-bold text-white">{request.distance_km.toFixed(1)} km</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5 text-center">
              <DollarSign className="w-4 h-4 text-green-400 mx-auto mb-1" />
              <p className="text-xs text-slate-400">Tarifa</p>
              <p className="text-sm font-bold text-white">${request.estimated_fare.toLocaleString('es-CO')}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5 text-center">
              <Smartphone className="w-4 h-4 text-sky-400 mx-auto mb-1" />
              <p className="text-xs text-slate-400">Pago</p>
              <p className="text-xs font-bold text-white">{PAYMENT_LABELS[request.payment_method] ?? request.payment_method}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleReject}
              className="h-12 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-semibold transition-all flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />Rechazar
            </button>
            <button
              onClick={handleAccept}
              className="h-12 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
            >
              <Check className="w-4 h-4" />Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
