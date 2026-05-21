import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bike, Plus, Search, Wrench, Gauge, Calendar, AlertTriangle,
  CheckCircle, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";

import { API_BASE as API, getAuthToken } from "@/lib/apiConfig";
function authHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Motorcycle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  engine_cc: number;
  status: "active" | "maintenance" | "retired";
  mileage: number;
  last_maintenance?: string;
  next_maintenance?: string;
  driver_name?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active:      { label: "Activa",         color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  maintenance: { label: "Mantenimiento",  color: "bg-amber-100 text-amber-700",    icon: Wrench },
  retired:     { label: "Retirada",       color: "bg-slate-100 text-slate-600",    icon: AlertTriangle },
};

const emptyForm = {
  plate: "", brand: "", model: "", year: new Date().getFullYear().toString(),
  color: "", engine_cc: "110", mileage: "0",
};

export default function Fleet() {
  const [fleet, setFleet]           = useState<Motorcycle[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [formData, setFormData]     = useState(emptyForm);

  const fetchFleet = useCallback(async () => {
    setLoading(true); setError("");
    try {
 const res = await fetch(`${API}/api/motorcycles`, { headers: authHeaders() });
 if (!res.ok) throw new Error(`Error ${res.status}`);
 const data = await res.json();
 setFleet(Array.isArray(data) ? data : data.motorcycles ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar flota");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError("");
    try {
      const body = { ...formData, year: Number(formData.year), engine_cc: Number(formData.engine_cc), mileage: Number(formData.mileage) };
      const res = await fetch(`${API}/api/motorcycles`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Error ${res.status}`); }
      setShowForm(false); setFormData(emptyForm); fetchFleet();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al registrar moto");
    } finally { setSubmitting(false); }
  };

  const filtered = fleet.filter((m) =>
    !search ||
    m.plate.toLowerCase().includes(search.toLowerCase()) ||
    m.brand.toLowerCase().includes(search.toLowerCase()) ||
    m.model.toLowerCase().includes(search.toLowerCase()) ||
    (m.driver_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalMoto       = fleet.length;
  const activeMoto      = fleet.filter((m) => m.status === "active").length;
  const inMaintenance   = fleet.filter((m) => m.status === "maintenance").length;
  const avgMileage      = totalMoto > 0 ? Math.round(fleet.reduce((s, m) => s + m.mileage, 0) / totalMoto) : 0;

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bike className="w-6 h-6 text-[#f97316]" /> Flota de Motos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalMoto} motocicletas · {activeMoto} activas · {inMaintenance} en mantenimiento
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchFleet}><RefreshCw className="w-4 h-4" /></Button>
          <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); setFormError(""); }}>
            <DialogTrigger asChild>
              <Button className="bg-[#f97316] hover:bg-[#ea580c]"><Plus className="w-4 h-4 mr-2" /> Nueva Moto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Registrar Motocicleta</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Placa *</Label>
                    <Input required value={formData.plate} onChange={(e) => setFormData({...formData, plate: e.target.value.toUpperCase()})} placeholder="AAA-000" /></div>
                  <div className="space-y-1"><Label>Año *</Label>
                    <Input type="number" required min="2000" max="2030" value={formData.year} onChange={(e) => setFormData({...formData, year: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Marca *</Label>
                    <Input required value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} placeholder="Honda, Yamaha..." /></div>
                  <div className="space-y-1"><Label>Modelo *</Label>
                    <Input required value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder="Wave 110..." /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Color</Label>
                    <Input value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} placeholder="Rojo" /></div>
                  <div className="space-y-1"><Label>CC</Label>
                    <Input type="number" min="50" value={formData.engine_cc} onChange={(e) => setFormData({...formData, engine_cc: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Km actuales</Label>
                    <Input type="number" min="0" value={formData.mileage} onChange={(e) => setFormData({...formData, mileage: e.target.value})} /></div>
                </div>
                {formError && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg"><AlertCircle className="w-4 h-4" /> {formError}</div>}
                <Button type="submit" disabled={submitting} className="w-full bg-[#f97316] hover:bg-[#ea580c]">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : "Registrar Moto"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { val: totalMoto,            label: "Total motos",       color: "text-slate-800" },
          { val: activeMoto,           label: "En operación",      color: "text-emerald-600" },
          { val: inMaintenance,        label: "En mantenimiento",  color: "text-amber-600" },
          { val: `${avgMileage.toLocaleString()} km`, label: "Km promedio", color: "text-blue-600" },
        ].map(({ val, label, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4">
              <div className={`text-2xl font-bold ${color}`}>{val}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Buscar por placa, marca, modelo o conductor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading && <div className="flex items-center justify-center py-20 gap-3 text-slate-500"><Loader2 className="w-6 h-6 animate-spin text-[#f97316]" /> Cargando flota...</div>}
      {!loading && error && <div className="flex flex-col items-center py-16 gap-3"><AlertCircle className="w-10 h-10 text-red-400" /><p>{error}</p><Button variant="outline" onClick={fetchFleet}>Reintentar</Button></div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-slate-400">
              <Bike className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">{fleet.length === 0 ? "No hay motos registradas" : "Sin resultados"}</p>
            </div>
          ) : filtered.map((moto) => {
            const sc = statusConfig[moto.status] || statusConfig.active;
            const maintenanceProgress = Math.min(100, (moto.mileage / 50000) * 100);
            return (
              <Card key={moto.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800">{moto.plate}</h3>
                        <Badge className={`${sc.color} text-[10px]`}>{sc.label}</Badge>
                      </div>
                      <p className="text-sm text-slate-600">{moto.brand} {moto.model} · {moto.year}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Bike className="w-5 h-5 text-slate-600" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
                    <div className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-slate-400" />{moto.mileage.toLocaleString()} km</div>
                    <div className="flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-slate-400" />{moto.engine_cc} cc</div>
                    {moto.next_maintenance && <div className="flex items-center gap-1.5 col-span-2"><Calendar className="w-3.5 h-3.5 text-slate-400" />Próx. mant: {moto.next_maintenance}</div>}
                    <div className="flex items-center gap-1.5 col-span-2"><Bike className="w-3.5 h-3.5 text-slate-400" />{moto.driver_name ?? "Sin asignar"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Vida útil del motor</span>
                      <span className="font-medium text-slate-700">{Math.round(maintenanceProgress)}%</span>
                    </div>
                    <Progress value={maintenanceProgress} className="h-1.5" />
                  </div>
                  {moto.status === "maintenance" && (
                    <div className="mt-3 flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-xs text-amber-700">En mantenimiento</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
