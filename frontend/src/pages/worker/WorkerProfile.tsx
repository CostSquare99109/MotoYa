import { useState, useEffect } from 'react';
import { useStore } from '@/hooks/useStore';
import type { WorkerStats, WorkerLevel } from '@/types';
import { ArrowLeft, Star, Bike, Trophy, TrendingUp, Shield, Zap, Award, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';

// ✅ API desde env var
import { API_BASE as API } from "@/lib/apiConfig";

// Niveles de gamificación — datos de configuración del producto (no son "datos de usuario")
const LEVELS: WorkerLevel[] = [
  { level: 1, name: 'Aprendiz',    min_points: 0,    max_points: 499,      color: '#64748b', perks: ['Acceso básico'] },
  { level: 2, name: 'Mensajero',   min_points: 500,  max_points: 999,      color: '#22c55e', perks: ['Prioridad en zonas B'] },
  { level: 3, name: 'Profesional', min_points: 1000, max_points: 2499,     color: '#f97316', perks: ['Prioridad alta', 'Bonos semanales'] },
  { level: 4, name: 'Elite',       min_points: 2500, max_points: 4999,     color: '#f59e0b', perks: ['Prioridad máxima', 'Comisión reducida', 'Soporte dedicado'] },
  { level: 5, name: 'Leyenda',     min_points: 5000, max_points: Infinity, color: '#a855f7', perks: ['Todo premium', 'Badge exclusivo', 'Acceso a zonas VIP'] },
];

function fmt(n: number) { return `$${n.toLocaleString('es-CO')}`; }

export default function WorkerProfile() {
  const navigate = useNavigate();
  const { user, token } = useStore();

  // ✅ Sin MOCK_STATS — null mientras carga, loading state visible
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(false);
    fetch(`${API}/api/workers/me/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => setStats(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const currentLevel = stats
    ? (LEVELS.find(l => stats.points >= l.min_points && stats.points <= l.max_points) ?? LEVELS[0])
    : LEVELS[0];
  const nextLevel = LEVELS.find(l => l.level === currentLevel.level + 1);
  const progress = stats && nextLevel
    ? ((stats.points - currentLevel.min_points) / (nextLevel.min_points - currentLevel.min_points)) * 100
    : 100;

  return (
    <div className="min-h-screen bg-[#070d1a] text-white pb-8">
      {/* Hero */}
      <div className="relative pt-10 pb-24 px-4" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #070d1a 100%)' }}>
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />Volver
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${currentLevel.color}33, ${currentLevel.color}66)`,
                border: `3px solid ${currentLevel.color}`,
              }}
            >
              {user?.full_name?.charAt(0) ?? '?'}
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#0f172a] flex items-center justify-center"
              style={{ border: `2px solid ${currentLevel.color}` }}
            >
              <Bike className="w-4 h-4" style={{ color: currentLevel.color }} />
            </div>
          </div>

          <h1 className="text-xl font-bold text-white">{user?.full_name ?? 'Conductor'}</h1>
          <p className="text-slate-400 text-sm">{user?.phone ?? ''}</p>

          <div
            className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
            style={{
              background: `${currentLevel.color}20`,
              border: `1px solid ${currentLevel.color}40`,
              color: currentLevel.color,
            }}
          >
            <Trophy className="w-3.5 h-3.5" />
            Nivel {currentLevel.level} · {currentLevel.name}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-16 space-y-4">
        {/* Loading */}
        {loading && (
          <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#f97316] animate-spin mr-3" />
            <span className="text-slate-400 text-sm">Cargando estadísticas…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <p className="text-red-400 text-sm">No se pudieron cargar las estadísticas.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-xs text-[#f97316] underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Stats from API */}
        {!loading && stats && (
          <>
            {/* Level progress */}
            <div className="bg-[#0f172a] rounded-2xl p-5 border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-400">Puntos acumulados</p>
                  <p className="text-3xl font-bold text-white">{stats.points.toLocaleString()}</p>
                </div>
                {nextLevel && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Próximo nivel</p>
                    <p className="text-sm font-semibold" style={{ color: nextLevel.color }}>{nextLevel.name}</p>
                    <p className="text-xs text-slate-500">{(nextLevel.min_points - stats.points).toLocaleString()} pts más</p>
                  </div>
                )}
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel?.color ?? currentLevel.color})`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-slate-500">
                <span>{currentLevel.name}</span>
                {nextLevel && <span>{nextLevel.name}</span>}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Star,       color: '#f59e0b', label: 'Calificación', value: stats.rating.toFixed(1) },
                { icon: Bike,       color: '#f97316', label: 'Total viajes', value: stats.total_trips.toString() },
                { icon: TrendingUp, color: '#22c55e', label: 'Este mes',     value: fmt(stats.earnings_month) },
                { icon: Shield,     color: '#a855f7', label: 'Aceptación',   value: `${stats.acceptance_rate}%` },
              ].map(({ icon: Icon, color, label, value }) => (
                <div key={label} className="bg-[#0f172a] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" style={{ color }} />
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                  <p className="text-xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Earnings */}
            <div className="bg-[#0f172a] rounded-2xl p-5 border border-white/5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#f97316]" />Ganancias
              </h3>
              {[
                { label: 'Hoy',          value: stats.earnings_today },
                { label: 'Esta semana',  value: stats.earnings_week },
                { label: 'Este mes',     value: stats.earnings_month },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className="font-bold text-white">{fmt(value)}</span>
                </div>
              ))}
            </div>

            {/* Badges */}
            {stats.badges.length > 0 && (
              <div className="bg-[#0f172a] rounded-2xl p-5 border border-white/5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-400" />Insignias ({stats.badges.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {stats.badges.map(b => (
                    <div
                      key={b}
                      className="px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{ background: 'rgba(249,115,22,.1)', color: '#f97316', border: '1px solid rgba(249,115,22,.2)' }}
                    >
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Level perks */}
            <div className="bg-[#0f172a] rounded-2xl p-5 border border-white/5">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" style={{ color: currentLevel.color }} />
                Beneficios nivel {currentLevel.name}
              </h3>
              {currentLevel.perks.map(p => (
                <div key={p} className="flex items-center gap-2 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: currentLevel.color }} />
                  <span className="text-sm text-slate-300">{p}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
