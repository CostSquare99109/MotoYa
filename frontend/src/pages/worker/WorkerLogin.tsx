import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '@/hooks/useStore';
import { Bike, Loader2, MapPin, Shield, Phone } from 'lucide-react';
import { authFetch, PasswordField, ErrorAlert, AuthForm } from '@/components/auth/AuthComponents';

import { API_BASE as API } from "@/lib/apiConfig";
const CITY_NAME = import.meta.env.VITE_CITY_NAME ?? 'Carepa, Antioquia';
const CITY_LABEL = import.meta.env.VITE_CITY_LABEL ?? `${CITY_NAME} · Colombia`;

export default function WorkerLogin() {
  const navigate = useNavigate();
  const { setToken, setUser } = useStore();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append('username', phone.trim());
      body.append('password', password);

      const data = await authFetch(`${API}/api/auth/worker/login`, body);
      setToken(data.access_token);
      setUser({
        id: data.user.id,
        driver_id: data.user.driver_id,
        full_name: data.user.full_name,
        phone: data.user.phone,
        email: data.user.email,
        role: 'worker',
        rating: data.user.rating,
        total_trips: data.user.total_trips,
        profile_photo_url: data.user.profile_photo_url,
      });
      navigate('/worker');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d1a] flex items-center justify-center p-4">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#f97316 1px, transparent 1px), linear-gradient(90deg, #f97316 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#f97316] opacity-10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="text-center pt-10 pb-8 px-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/20 mb-4">
              <Bike className="w-10 h-10 text-[#f97316]" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Portal Conductor</h1>
            <p className="text-slate-400 text-sm mt-1">MotoYa · {CITY_NAME}</p>
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-[#f97316]/10 rounded-full">
              <Shield className="w-3.5 h-3.5 text-[#f97316]" />
              <span className="text-xs text-[#f97316] font-medium">Acceso exclusivo para conductores</span>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 pb-8">
            <AuthForm
              onSubmit={handleLogin}
              loading={loading}
              loadingText={<><Loader2 className="w-4 h-4 animate-spin" />Ingresando...</>}
              submitText="Iniciar turno"
              variant="dark"
              disabled={!phone || !password}
            >
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Número de teléfono
                </label>
                <input
                  type="tel"
                  placeholder="3001234567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                  className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] transition-all"
                />
                <p className="text-xs text-slate-500">El mismo número registrado por el administrador</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Contraseña</label>
                <PasswordField value={password} onChange={setPassword} variant="dark" />
              </div>

              <ErrorAlert message={error} variant="dark" />
            </AuthForm>

            <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1 pt-4">
              <MapPin className="w-3 h-3" />{CITY_LABEL}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          ¿Eres pasajero?{' '}
          <a href="/client/login" className="text-[#f97316] hover:underline">Accede aquí</a>
        </p>
      </div>
    </div>
  );
}
