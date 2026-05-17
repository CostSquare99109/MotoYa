import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User, MapPin, Phone, Clock, Navigation,
  CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Trip {
  id: string;
  passenger_name?: string;
  passenger_phone?: string;
  pickup_address: string;
  dropoff_address: string;
  status: string;
  fare?: number;
  payment_method: string;
  created_at: string;
}

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  return `Hace ${Math.floor(mins / 60)}h`;
}

export default function RequestPanel() {
  const [trips, setTrips]     = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/trips?status=pending&limit=20`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setTrips(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15000); // refresca cada 15s
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleAssign = async (tripId: string) => {
    try {
      const res = await fetch(`${API}/api/trips/${tripId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: "assigned" }),
      });
      if (!res.ok) throw new Error();
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    } catch {
      // silently ignore — el usuario puede reintentar
    }
  };

  const handleReject = async (tripId: string) => {
    try {
      const res = await fetch(`${API}/api/trips/${tripId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error();
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    } catch {
      // silently ignore
    }
  };

  const pendingCount = trips.filter((t) => t.status === "pending").length;

  return (
    <Card className="h-full flex flex-col shadow-md border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#f97316]" />
            Solicitudes Entrantes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchPending}>
              <RefreshCw className="w-3 h-3 text-slate-400" />
            </Button>
            {pendingCount > 0 && (
              <Badge className="bg-[#f97316] text-white text-xs">
                {pendingCount} nuevas
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-[#f97316]" />
                Cargando solicitudes...
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-400 text-sm">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={fetchPending}>
                  Reintentar
                </Button>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && trips.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                No hay solicitudes pendientes
              </div>
            )}

            {/* Cards */}
            {!loading && !error && trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onAssign={() => handleAssign(trip.id)}
                onReject={() => handleReject(trip.id)}
              />
            ))}

          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function TripCard({
  trip,
  onAssign,
  onReject,
}: {
  trip: Trip;
  onAssign: () => void;
  onReject: () => void;
}) {
  const paymentLabel: Record<string, string> = {
    cash:   "Efectivo",
    card:   "Tarjeta",
    wallet: "Billetera",
  };

  return (
    <div className="p-3 rounded-lg border bg-white border-slate-200 hover:border-[#f97316]/50 hover:shadow-sm transition-all">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#0f172a] flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">
              {trip.passenger_name ?? "Pasajero"}
            </div>
            {trip.passenger_phone && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Phone className="w-3 h-3" />
                {trip.passenger_phone}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-[#f97316]">
            {trip.fare != null
              ? `$${Number(trip.fare).toLocaleString("es-CO")}`
              : "—"}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            {getTimeAgo(trip.created_at)}
          </div>
        </div>
      </div>

      {/* Ruta */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-start gap-2 text-xs">
          <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <span className="text-slate-600 line-clamp-1">{trip.pickup_address}</span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
          <span className="text-slate-600 line-clamp-1">{trip.dropoff_address}</span>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-[10px]">
          {paymentLabel[trip.payment_method] ?? trip.payment_method}
        </Badge>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
            onClick={onReject}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Rechazar
          </Button>
          <Button
            size="sm"
            className="h-7 px-2 text-xs bg-[#f97316] hover:bg-[#ea580c] text-white"
            onClick={onAssign}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Asignar
          </Button>
        </div>
      </div>
    </div>
  );
}
