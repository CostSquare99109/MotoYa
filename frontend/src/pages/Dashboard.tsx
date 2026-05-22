import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, TrendingUp, Bike, Clock, DollarSign, Navigation,
} from "lucide-react";
import TripTable from "@/sections/TripTable";
import RequestPanel from "@/sections/RequestPanel";
import { useStore } from "@/hooks/useStore";

import { API_BASE as API, getAuthToken } from "@/lib/apiConfig";

function authHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface DashboardStats {
  onlineDrivers: number;
  pendingTrips: number;
  todayRevenue: number;
  completedToday: number;
  avgResponseTime: string;
  activeShipments: number;
}

function formatSeconds(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export default function Dashboard() {
  const { setDrivers, setTrips } = useStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [driversRes, tripsRes, financeRes, shipmentsRes, responseTimeRes] = await Promise.allSettled([
        fetch(`${API}/api/drivers`, { headers: authHeaders() }),
        fetch(`${API}/api/trips/stats/summary`, { headers: authHeaders() }),
        fetch(`${API}/api/finances/summary?today=true`, { headers: authHeaders() }),
        fetch(`${API}/api/shipments?status=in_transit`, { headers: authHeaders() }),
        fetch(`${API}/api/trips/stats/avg-response-time`, { headers: authHeaders() }),
      ]);

      let onlineDrivers = 0;
      if (driversRes.status === "fulfilled" && driversRes.value.ok) {
        const d = await driversRes.value.json();
        const list = Array.isArray(d) ? d : d.drivers ?? [];
        setDrivers(list);
        onlineDrivers = list.filter((dr: { is_online: boolean }) => dr.is_online).length;
      }

      let pendingTrips = 0, completedToday = 0;
      if (tripsRes.status === "fulfilled" && tripsRes.value.ok) {
        const t = await tripsRes.value.json();
        setTrips(t.trips ?? []);
        pendingTrips = t.pending_trips ?? 0;
        completedToday = t.completed_today ?? 0;
      }

      let todayRevenue = 0;
      if (financeRes.status === "fulfilled" && financeRes.value.ok) {
        const f = await financeRes.value.json();
        todayRevenue = f.total_gross ?? f.total_net ?? 0;
      }

      let activeShipments = 0;
      if (shipmentsRes.status === "fulfilled" && shipmentsRes.value.ok) {
        const s = await shipmentsRes.value.json();
        activeShipments = Array.isArray(s) ? s.length : s.total ?? 0;
      }

      let avgResponseTime = "—";
      if (responseTimeRes.status === "fulfilled" && responseTimeRes.value.ok) {
        const rt = await responseTimeRes.value.json();
        avgResponseTime = formatSeconds(rt.avg_response_seconds ?? 0);
      }

      setStats({ onlineDrivers, pendingTrips, todayRevenue, completedToday, avgResponseTime, activeShipments });
    } catch {
      setStats({ onlineDrivers: 0, pendingTrips: 0, todayRevenue: 0, completedToday: 0, avgResponseTime: "—", activeShipments: 0 });
    } finally {
      setLoading(false);
    }
  }, [setDrivers, setTrips]);

  useEffect(() => {
    loadData();
    // Refrescar cada 30s
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const statCards = [
    { label: "Conductores Online", value: stats?.onlineDrivers ?? 0, icon: Users, iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconColor: "text-emerald-600 dark:text-emerald-400", badge: "En línea", badgeColor: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { label: "Viajes Pendientes", value: stats?.pendingTrips ?? 0, icon: Navigation, iconBg: "bg-amber-100 dark:bg-amber-900/40", iconColor: "text-amber-600 dark:text-amber-400", badge: "Urgentes", badgeColor: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
    { label: "Ingresos Hoy", value: `$ ${(stats?.todayRevenue ?? 0).toLocaleString("es-CO")}`, icon: DollarSign, iconBg: "bg-blue-100 dark:bg-blue-900/40", iconColor: "text-blue-600 dark:text-blue-400", badge: "COP", badgeColor: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Completados", value: stats?.completedToday ?? 0, icon: TrendingUp, iconBg: "bg-purple-100 dark:bg-purple-900/40", iconColor: "text-purple-600 dark:text-purple-400", badge: "Hoy", badgeColor: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
    { label: "Tiempo Respuesta", value: stats?.avgResponseTime ?? "—", icon: Clock, iconBg: "bg-orange-100 dark:bg-orange-900/40", iconColor: "text-orange-600 dark:text-orange-400", badge: "Promedio", badgeColor: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Envíos Activos", value: stats?.activeShipments ?? 0, icon: Bike, iconBg: "bg-cyan-100 dark:bg-cyan-900/40", iconColor: "text-cyan-600 dark:text-cyan-400", badge: "Moto-Envío", badgeColor: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* KPI cards */}
      <div className="grid grid-cols-6 gap-3 px-4 pt-4 pb-3 flex-shrink-0">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))
          : statCards.map((stat, i) => (
              <Card key={i} className="shadow-sm hover:shadow-md transition-shadow border-slate-200 dark:border-slate-700 dark:bg-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                      <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                    </div>
                    <Badge className={`${stat.badgeColor} text-[10px] font-medium`}>{stat.badge}</Badge>
                  </div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Content area — tabla a la izquierda, paneles a la derecha */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        <div className="flex gap-4 h-full">
          {/* Tabla de viajes — ocupa el espacio restante */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <TripTable />
          </div>

          {/* Paneles laterales */}
          <div className="w-[360px] flex-shrink-0 flex flex-col gap-3 h-full">
            <div className="flex-1 min-h-0"><RequestPanel /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
