import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bike, Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/hooks/useStore';
import { authFetch, PasswordField, ErrorAlert, AuthForm } from '@/components/auth/AuthComponents';

import { API_BASE as API } from "@/lib/apiConfig";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append('username', email);
      body.append('password', password);

      const data = await authFetch(`${API}/api/auth/login`, body);
      setToken(data.access_token);
      setUser(data.user);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-[#0f172a] px-8 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#f97316] mb-4">
              <Bike className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">MotoYa</h1>
            <p className="text-slate-400 text-sm mt-1">Plataforma de Gestión de Flota</p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <MapPin className="w-3.5 h-3.5 text-[#f97316]" />
              <span className="text-xs text-slate-400">Carepa, Antioquia</span>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Iniciar sesión</h2>
            <p className="text-sm text-slate-500 mb-6">Ingresa tus credenciales de administrador</p>

            <AuthForm
              onSubmit={handleLogin}
              loading={loading}
              loadingText={<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ingresando...</>}
              submitText="Ingresar"
              variant="light"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@motoya.co"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <PasswordField value={password} onChange={setPassword} variant="light" />
              </div>

              <ErrorAlert message={error} variant="light" />
            </AuthForm>
          </div>
        </div>
      </div>
    </div>
  );
}
