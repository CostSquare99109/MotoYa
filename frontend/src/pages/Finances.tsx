import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign, TrendingUp, Trophy, Star, Zap, Award, Target,
  Crown, Medal, Flame, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";
import type { RankingEntry } from "@/types";

const API = import.meta.env.VITE_API_URL ?? "";
function authHeaders() {
  const token = localStorage.getItem("token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface FinanceSummary {
  total_gross: number;
  total_commissions: number;
  total_fuel: number;
  total_net: number;
  trip_count: number;
  avg_per_trip: number;
}

const tierConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Medal; min: number }> = {
  bronze:   { label: "Bronce",  color: "text-amber-700",  bg: "bg-amber-100",  icon: Medal,  min: 0 },
  silver:   { label: "Plata",   color: "text-slate-500",  bg: "bg-slate-200",  icon: Award,  min: 500 },
  gold:     { label: "Oro",     color: "text-amber-500",  bg: "bg-amber-100",  icon: Trophy, min: 1500 },
  platinum: { label: "Platino", color: "text-purple-600", bg: "bg-purple-100", icon: Crown,  min: 3000 },
};

export default function Finances() {
  const [summary, setSummary]     = useState<FinanceSummary | null>(null);
  const [rankings, setRankings]   = useState<RankingEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [finRes, rankRes] = await Promise.allSettled([
        fetch(`${API}/api/finances/summary`, { headers: authHeaders() }),
        fetch(`${API}/api/rankings`, { headers: authHeaders() }),
      ]);
      if (finRes.status === "fulfilled" && finRes.value.ok) {
        setSummary(await finRes.value.json());
      }
      if (rankRes.status === "fulfilled" && rankRes.value.ok) {
        const d = await rankRes.value.json();
        setRankings(Array.isArray(d) ? d : d.rankings ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full gap-3 text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin text-[#f97316]" /> Cargando finanzas...
    </div>
  );

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#f97316]" /> Finanzas y Gamificación
          </h1>
          <p className="text-sm text-slate-500 mt-1">Panel de ganancias y sistema de rangos</p>
        </div>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4" /> {error} — mostrando datos disponibles
        </div>
      )}

      {/* Finance summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Ingresos Brutos",   val: summary?.total_gross ?? 0,       icon: TrendingUp, border: "border-l-emerald-500", iconColor: "text-emerald-500" },
          { label: "Comisiones (15%)",  val: summary?.total_commissions ?? 0, icon: Zap,        border: "border-l-red-400",     iconColor: "text-red-400" },
          { label: "Combustible",       val: summary?.total_fuel ?? 0,        icon: Flame,      border: "border-l-amber-400",   iconColor: "text-amber-500" },
          { label: "GANANCIA NETA",     val: summary?.total_net ?? 0,         icon: Target,     border: "border-l-[#f97316]",   iconColor: "text-[#f97316]" },
        ].map(({ label, val, icon: Icon, border, iconColor }) => (
          <Card key={label} className={`shadow-sm border-l-4 ${border}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">{label}</span>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div className={`text-2xl font-bold ${label === "GANANCIA NETA" ? "text-[#f97316]" : "text-slate-800"}`}>
                $ {val.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
              </div>
              {label === "GANANCIA NETA" && summary && (
                <div className="text-xs text-slate-500 mt-1">
                  {summary.trip_count} viajes · $ {summary.avg_per_trip.toFixed(0)} promedio
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier system */}
      <Card className="mb-6 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#f97316]" /> Sistema de Rangos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(tierConfig).map(([key, tier]) => (
              <div key={key} className={`p-4 rounded-lg ${tier.bg} border border-slate-200/50`}>
                <div className="flex items-center gap-2 mb-2">
                  <tier.icon className={`w-5 h-5 ${tier.color}`} />
                  <span className={`font-bold ${tier.color}`}>{tier.label}</span>
                </div>
                <div className="text-xs text-slate-600">Desde {tier.min} puntos</div>
                <div className="text-xs text-slate-500 mt-1">
                  Comisión: {key === "bronze" ? "15%" : key === "silver" ? "12%" : key === "gold" ? "10%" : "8%"}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" /> Tabla de Clasificación
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rankings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aún no hay datos de ranking. Los conductores aparecerán aquí cuando completen viajes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rankings.map((entry) => {
                const tier = tierConfig[entry.tier] ?? tierConfig.bronze;
                const pointsToNext = entry.tier === "bronze" ? 500 - entry.points
                  : entry.tier === "silver" ? 1500 - entry.points
                  : entry.tier === "gold"   ? 3000 - entry.points : 0;
                const nextTierName = entry.tier === "bronze" ? "Plata" : entry.tier === "silver" ? "Oro"
                  : entry.tier === "gold" ? "Platino" : "Máximo";
                return (
                  <div key={entry.rank} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      entry.rank === 1 ? "bg-amber-100 text-amber-700" : entry.rank === 2 ? "bg-slate-200 text-slate-600" : entry.rank === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                    }`}>{entry.rank}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{entry.driver_name}</span>
                        <Badge className={`${tier.bg} ${tier.color} text-[10px]`}>{tier.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-500 fill-amber-500" />{Number(entry.rating_avg).toFixed(1)}</span>
                        <span>{entry.monthly_trips} viajes/mes</span>
                      </div>
                      {pointsToNext > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={entry.tier === "bronze" ? (entry.points / 500) * 100 : entry.tier === "silver" ? ((entry.points - 500) / 1000) * 100 : ((entry.points - 1500) / 1500) * 100} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-slate-400">{pointsToNext} pts para {nextTierName}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1"><Zap className="w-4 h-4 text-[#f97316]" /><span className="text-lg font-bold text-slate-800">{entry.points}</span></div>
                      <span className="text-[10px] text-slate-400">puntos</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
