import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/hooks/useApi";
import type { User } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Search, Phone, Mail, RefreshCw, Loader2, AlertCircle, Bike,
} from "lucide-react";

// ── Colores por estado ────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string }> = {
  active:    { label: "Activo",     color: "bg-emerald-100 text-emerald-700" },
  suspended: { label: "Suspendido", color: "bg-red-100 text-red-700" },
  pending:   { label: "Pendiente",  color: "bg-amber-100 text-amber-700" },
};

export default function Drivers() {
  const api = useApi();

  const [conductores, setConductores] = useState<User[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Carga conductores desde el endpoint de usuarios filtrado por rol worker ─
  const fetchConductores = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Trae solo los usuarios con rol "worker" — los mismos que se ven
      // en /users cuando se filtra por "Conductor"
      const data = await api.get<User[]>("/users?role=worker");
      setConductores(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar conductores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConductores(); }, [fetchConductores]);

  // ── Filtrado local ────────────────────────────────────────────────────────
  const filtered = conductores.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      c.full_name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 h-full overflow-auto">

      {/* Header — sin botón de agregar, es solo visualización */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#f97316]" />
            Conductores
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {conductores.length} conductores registrados
            {conductores.filter(c => c.status === "active").length > 0 && (
              <> · {conductores.filter(c => c.status === "active").length} activos</>
            )}
            <span className="ml-2 text-slate-400">
              — Para agregar conductores ve a{" "}
              <a href="/users" className="text-[#f97316] underline hover:text-[#ea580c]">
                Usuarios
              </a>
            </span>
          </p>
        </div>

        <Button variant="outline" size="icon" onClick={fetchConductores} title="Recargar">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-4 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, teléfono o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="suspended">Suspendidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Estado cargando */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#f97316]" />
          <span>Cargando conductores...</span>
        </div>
      )}

      {/* Estado error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-slate-600">{error}</p>
          <Button variant="outline" onClick={fetchConductores}>Reintentar</Button>
        </div>
      )}

      {/* Grid de tarjetas */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((conductor) => {
            const sc = statusConfig[conductor.status] ?? statusConfig.pending;
            return (
              <Card key={conductor.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">

                  {/* Cabecera: avatar + nombre + estado */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#0f172a] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {conductor.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 leading-tight">
                          {conductor.full_name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Desde {new Date(conductor.created_at).toLocaleDateString("es-CO")}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${sc.color} text-[10px] border-0 shrink-0`}>
                      {sc.label}
                    </Badge>
                  </div>

                  {/* Datos de contacto */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{conductor.phone ?? <span className="text-slate-400 italic">Sin teléfono</span>}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{conductor.email ?? <span className="text-slate-400 italic">Sin email</span>}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bike className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-400 italic">Conductor registrado desde Usuarios</span>
                    </div>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Estado vacío */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          {conductores.length === 0 ? (
            <>
              <p className="text-lg font-medium">Aún no hay conductores</p>
              <p className="text-sm mt-1">
                Ve a{" "}
                <a href="/users" className="text-[#f97316] underline hover:text-[#ea580c]">
                  Usuarios
                </a>{" "}
                y crea un usuario con rol <strong>Conductor</strong>
              </p>
            </>
          ) : (
            <p className="text-lg font-medium">No se encontraron conductores con ese filtro</p>
          )}
        </div>
      )}

    </div>
  );
}
