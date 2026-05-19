// ─── pages/client/ClientLogin.tsx ────────────────────────────────────────────
// Flujo simplificado: solo nombre + teléfono + botón "Ubicación actual"
// Sin OTP, sin contraseña. Se crea o recupera el usuario por número de teléfono.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '@/hooks/useStore';
import { Bike, MapPin, Navigation, Loader2, User, Phone } from 'lucide-react';

import { API_BASE as API } from "@/lib/apiConfig";

export default function ClientLogin() {
  const navigate = useNavigate();
  const { setToken, setUser } = useStore();

  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [locMsg,  setLocMsg]  = useState('');   // mensaje de estado de GPS
  const [error,   setError]   = useState('');

  // ── Validación básica ────────────────────────────────────────────────────────
  const isReady = name.trim().length >= 2 && phone.length >= 7;

  // ── Handler principal: obtiene GPS → autentica → entra ───────────────────────
  const handleEnter = async () => {
    if (!name.trim())         { setError('Escribe tu nombre');          return; }
    if (phone.length < 7)     { setError('Número de teléfono inválido'); return; }
    setError('');
    setLoading(true);

    // 1. Obtener ubicación GPS
    let coords: { lat: number; lng: number } | null = null;
    try {
      setLocMsg('Obteniendo ubicación…');
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 10_000,
        })
      );
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocMsg('Ubicación obtenida ✓');
    } catch {
      setLocMsg('Ubicación no disponible — continuando sin GPS');
    }

    // 2. Quick-login / registro en el backend
    try {
      const res = await fetch(`${API}/api/auth/client/quick-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name.trim(), phone }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setToken(data.access_token);
        // Guardamos coords en el objeto user para que ClientHome las use
        setUser({ ...data.user, role: 'client', coords });
      } else {
        throw new Error(data.detail || 'Error de servidor');
      }
    } catch {
      // ── Modo demo: funciona sin backend ──────────────────────────────────
      const mockUser = {
        id:        `demo-${phone}`,
        full_name: name.trim(),
        phone,
        role:      'client' as const,
        coords,
      };
      setToken('demo-client-token');
      setUser(mockUser);
    } finally {
      setLoading(false);
    }

    navigate('/client');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* ── Logo ── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-[#f97316] mb-5 shadow-2xl shadow-orange-500/40">
            <Bike className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">MotoYa</h1>
          <p className="text-slate-400 text-sm mt-2 flex items-center justify-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#f97316]" />
            Carepa, Antioquia
          </p>
        </div>

        {/* ── Card ── */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7 space-y-5">
          <h2 className="text-white font-bold text-xl">¡Hola! ¿Cómo te llamas?</h2>

          {/* Nombre */}
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tu nombre"
              value={name}
              autoComplete="name"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEnter()}
              className="w-full py-3.5 pl-11 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#f97316] transition-colors font-medium"
            />
          </div>

          {/* Teléfono */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold select-none">
              +57
            </span>
            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="tel"
              inputMode="numeric"
              placeholder="300 000 0000"
              value={phone}
              autoComplete="tel"
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={e => e.key === 'Enter' && handleEnter()}
              className="w-full py-3.5 pl-14 pr-10 rounded-xl bg-white/10 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#f97316] transition-colors font-medium tracking-widest"
            />
          </div>

          {/* Mensaje de estado GPS */}
          {locMsg && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#f97316]" />{locMsg}
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm font-medium">{error}</p>
          )}

          {/* ── Botón principal ── */}
          <button
            onClick={handleEnter}
            disabled={loading || !isReady}
            className="w-full py-4 rounded-2xl bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.98] text-white font-black text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-orange-500/30 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {locMsg.includes('Obteniendo') ? 'Obteniendo ubicación…' : 'Entrando…'}
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                Ubicación actual
              </>
            )}
          </button>
        </div>

        {/* ── Link conductor ── */}
        <p className="text-center text-xs text-slate-500 mt-5">
          ¿Eres conductor?{' '}
          <a href="/worker/login" className="text-[#f97316] hover:underline font-medium">
            Ingresa aquí
          </a>
        </p>

      </div>
    </div>
  );
}
