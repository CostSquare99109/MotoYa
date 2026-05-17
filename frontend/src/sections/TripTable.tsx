import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, User, Eye, ArrowRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Assignment {
  id: string;
  passenger_name: string;
  driver_name: string;
  pickup_address: string;
  dropoff_address: string;
  status: string;
  fare?: number;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pendiente",  color: "bg-amber-100 text-amber-700" },
  assigned:    { label: "Asignado",   color: "bg-blue-100 text-blue-700" },
  picked_up:   { label: "Recogido",   color: "bg-purple-100 text-purple-700" },
  in_progress: { label: "En ruta",    color: "bg-[#f97316]/10 text-[#f97316]" },
  completed:   { label: "Completado", color: "bg-emerald-100 text-emerald-700" },
  cancelled:   { label: "Cancelado",  color: "bg-red-100 text-red-700" },
};

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  return `Hace ${Math.floor(mins / 60)}h`;
}

export default function TripTable() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/trips/latest/assignments?limit=10`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar asignaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
    const interval = setInterval(fetchAssignments, 30000);
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  return (
    <Card className="shadow-md border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#f97316]" />
            Últimas Asignaciones
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchAssignments}>
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-[#f97316]">
              Ver todas <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[#f97316]" />
            Cargando asignaciones...
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400 text-sm">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchAssignments}>
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && assignments.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            No hay asignaciones recientes
          </div>
        )}

        {!loading && !error && assignments.length > 0 && (
          <ScrollArea className="max-h-[280px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Pasajero</th>
                  <th className="px-4 py-2.5 font-medium">Conductor</th>
                  <th className="px-4 py-2.5 font-medium">Ruta</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium text-right">Tarifa</th>
                  <th className="px-4 py-2.5 font-medium text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => {
                  const sc = statusConfig[a.status] ?? statusConfig.pending;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#0f172a] flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">{a.passenger_name}</span>
                            {a.created_at && (
                              <div className="text-[10px] text-slate-400">{getTimeAgo(a.created_at)}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{a.driver_name}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5 max-w-[200px]">
                          <div className="flex items-center gap-1 text-xs text-slate-500 line-clamp-1">
                            <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            {a.pickup_address ?? "—"}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 line-clamp-1">
                            <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                            {a.dropoff_address ?? "—"}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${sc.color} text-[10px] font-medium`}>
                          {sc.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {a.fare != null
                          ? `$${Number(a.fare).toLocaleString("es-CO")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="w-4 h-4 text-slate-400" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
