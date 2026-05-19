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
  Package, Plus, Search, MapPin, Phone, User, Camera,
  Mic, Truck, Clock, CheckCircle, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";

import { API_BASE as API, getAuthToken } from "@/lib/apiConfig";
function authHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Shipment {
  id: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  pickup_address: string;
  delivery_address: string;
  description?: string;
  weight_kg?: number;
  dimensions?: string;
  status: "pending" | "picked_up" | "in_transit" | "delivered" | "cancelled";
  fare?: number;
  driver_id?: string;
  photos: string[];
  voice_commands: string[];
  pickup_location?: { lat: number; lng: number };
  delivery_location?: { lat: number; lng: number };
  created_at: string;
  updated_at: string;
}

// Coincide exactamente con ShipmentCreate del backend
interface ShipmentCreateBody {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  pickup_address: string;
  delivery_address: string;
  description?: string;
  weight_kg?: number;
  dimensions?: string;
  // Obligatorios en backend
  pickup_lat: number;
  pickup_lng: number;
  delivery_lat: number;
  delivery_lng: number;
}

const emptyForm = {
  sender_name:      "",
  sender_phone:     "",
  receiver_name:    "",
  receiver_phone:   "",
  pickup_address:   "",
  delivery_address: "",
  description:      "",
  weight_kg:        "",
  dimensions:       "",
  // Coordenadas — el usuario las escribe o se geocodifican
  pickup_lat:       "",
  pickup_lng:       "",
  delivery_lat:     "",
  delivery_lng:     "",
};

const statusConfig: Record<string, { label: string; color: string; step: number }> = {
  pending:    { label: "Pendiente",   color: "bg-amber-100 text-amber-700",     step: 0 },
  picked_up:  { label: "Recogido",    color: "bg-blue-100 text-blue-700",       step: 1 },
  in_transit: { label: "En tránsito", color: "bg-purple-100 text-purple-700",   step: 2 },
  delivered:  { label: "Entregado",   color: "bg-emerald-100 text-emerald-700", step: 3 },
  cancelled:  { label: "Cancelado",   color: "bg-red-100 text-red-700",         step: -1 },
};
const STEPS = ["Pendiente", "Recogido", "En tránsito", "Entregado"];

export default function Shipments() {
  const [shipments, setShipments]   = useState<Shipment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [formData, setFormData]     = useState(emptyForm);

  // Helper para actualizar un campo del form
  const setField = (field: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/shipments`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setShipments(Array.isArray(data) ? data : (data.shipments ?? []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar envíos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");

    // Validar coordenadas obligatorias
    const pickupLat  = parseFloat(formData.pickup_lat);
    const pickupLng  = parseFloat(formData.pickup_lng);
    const deliveryLat = parseFloat(formData.delivery_lat);
    const deliveryLng = parseFloat(formData.delivery_lng);

    if (isNaN(pickupLat)  || isNaN(pickupLng))  {
      setFormError("Coordenadas de recogida inválidas");
      setSubmitting(false);
      return;
    }
    if (isNaN(deliveryLat) || isNaN(deliveryLng)) {
      setFormError("Coordenadas de entrega inválidas");
      setSubmitting(false);
      return;
    }

    // Construir body exactamente como ShipmentCreate
    const body: ShipmentCreateBody = {
      sender_name:      formData.sender_name.trim(),
      sender_phone:     formData.sender_phone.trim(),
      receiver_name:    formData.receiver_name.trim(),
      receiver_phone:   formData.receiver_phone.trim(),
      pickup_address:   formData.pickup_address.trim(),
      delivery_address: formData.delivery_address.trim(),
      pickup_lat:       pickupLat,
      pickup_lng:       pickupLng,
      delivery_lat:     deliveryLat,
      delivery_lng:     deliveryLng,
      // Opcionales — solo si tienen valor
      ...(formData.description.trim() && { description: formData.description.trim() }),
      ...(formData.weight_kg         && { weight_kg:   parseFloat(formData.weight_kg) }),
      ...(formData.dimensions.trim() && { dimensions:  formData.dimensions.trim() }),
    };

    try {
      const res = await fetch(`${API}/api/shipments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // FastAPI 422 devuelve detail como array
        const detail = Array.isArray(err.detail)
          ? err.detail
              .map((d: { loc: string[]; msg: string }) =>
                `${d.loc.at(-1)}: ${d.msg}`
              )
              .join(" · ")
          : err.detail || `Error ${res.status}`;
        throw new Error(detail);
      }

      setShowForm(false);
      setFormData(emptyForm);
      fetchShipments();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al crear envío");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = shipments.filter(
    (s) =>
      !search ||
      s.sender_name.toLowerCase().includes(search.toLowerCase()) ||
      s.receiver_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const pending   = shipments.filter((s) => s.status === "pending").length;
  const inTransit = shipments.filter((s) => s.status === "in_transit").length;
  const delivered = shipments.filter((s) => s.status === "delivered").length;
  const totalPhotos = shipments.reduce((acc, s) => acc + (s.photos?.length ?? 0), 0);

  return (
    <div className="p-6 h-full overflow-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-[#f97316]" /> Moto-Envío
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Logística de envíos por motocicleta · {shipments.length} envíos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchShipments}>
            <RefreshCw className="w-4 h-4" />
          </Button>

          <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); setFormError(""); }}>
            <DialogTrigger asChild>
              <Button className="bg-[#f97316] hover:bg-[#ea580c]">
                <Plus className="w-4 h-4 mr-2" /> Nuevo Envío
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar Envío</DialogTitle></DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {/* ── Remitente ─────────────────────────────────────────── */}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Remitente
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nombre *</Label>
                    <Input required value={formData.sender_name}
                      onChange={setField("sender_name")} placeholder="Tienda ABC" />
                  </div>
                  <div className="space-y-1">
                    <Label>Teléfono *</Label>
                    <Input required value={formData.sender_phone}
                      onChange={setField("sender_phone")} placeholder="+57 300 000 0000" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Dirección recogida *</Label>
                  <Input required value={formData.pickup_address}
                    onChange={setField("pickup_address")} placeholder="Calle 10 #5-20, Carepa" />
                </div>

                {/* Coordenadas recogida */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Latitud recogida *</Label>
                    <Input required type="number" step="any"
                      value={formData.pickup_lat} onChange={setField("pickup_lat")}
                      placeholder="7.7640" />
                  </div>
                  <div className="space-y-1">
                    <Label>Longitud recogida *</Label>
                    <Input required type="number" step="any"
                      value={formData.pickup_lng} onChange={setField("pickup_lng")}
                      placeholder="-76.6530" />
                  </div>
                </div>

                {/* ── Destinatario ───────────────────────────────────────── */}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Destinatario
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nombre *</Label>
                    <Input required value={formData.receiver_name}
                      onChange={setField("receiver_name")} placeholder="Juan Pérez" />
                  </div>
                  <div className="space-y-1">
                    <Label>Teléfono *</Label>
                    <Input required value={formData.receiver_phone}
                      onChange={setField("receiver_phone")} placeholder="+57 300 000 0000" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Dirección entrega *</Label>
                  <Input required value={formData.delivery_address}
                    onChange={setField("delivery_address")} placeholder="Carrera 3 #8-15, Carepa" />
                </div>

                {/* Coordenadas entrega */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Latitud entrega *</Label>
                    <Input required type="number" step="any"
                      value={formData.delivery_lat} onChange={setField("delivery_lat")}
                      placeholder="7.7700" />
                  </div>
                  <div className="space-y-1">
                    <Label>Longitud entrega *</Label>
                    <Input required type="number" step="any"
                      value={formData.delivery_lng} onChange={setField("delivery_lng")}
                      placeholder="-76.6490" />
                  </div>
                </div>

                {/* ── Paquete ────────────────────────────────────────────── */}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Paquete
                </p>
                <div className="space-y-1">
                  <Label>Descripción</Label>
                  <Input value={formData.description}
                    onChange={setField("description")} placeholder="Documentos, ropa, electrónico..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Peso (kg)</Label>
                    <Input type="number" step="0.1" min="0"
                      value={formData.weight_kg} onChange={setField("weight_kg")}
                      placeholder="1.5" />
                  </div>
                  <div className="space-y-1">
                    <Label>Dimensiones</Label>
                    <Input value={formData.dimensions}
                      onChange={setField("dimensions")} placeholder="30x20x10 cm" />
                  </div>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <Button type="submit" disabled={submitting}
                  className="w-full bg-[#f97316] hover:bg-[#ea580c]">
                  {submitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
                    : "Crear Envío"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: Clock,       bg: "bg-amber-100",   color: "text-amber-600",   val: pending,     label: "Pendientes"  },
          { icon: Truck,       bg: "bg-purple-100",  color: "text-purple-600",  val: inTransit,   label: "En tránsito" },
          { icon: CheckCircle, bg: "bg-emerald-100", color: "text-emerald-600", val: delivered,   label: "Entregados"  },
          { icon: Camera,      bg: "bg-blue-100",    color: "text-blue-600",    val: totalPhotos, label: "Fotos"       },
        ].map(({ icon: Icon, bg, color, val, label }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-800">{val}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Buscar por remitente, destinatario o descripción..."
          value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* ── States ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#f97316]" /> Cargando envíos...
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center py-16 gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-slate-600">{error}</p>
          <Button variant="outline" onClick={fetchShipments}>Reintentar</Button>
        </div>
      )}

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">
                {shipments.length === 0 ? "No hay envíos registrados" : "Sin resultados"}
              </p>
            </div>
          ) : (
            filtered.map((s) => {
              const sc = statusConfig[s.status] ?? statusConfig.pending;
              const progress = s.status === "cancelled" ? 0 : ((sc.step + 1) / 4) * 100;

              return (
                <Card key={s.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#f97316]/10 flex items-center justify-center">
                          <Package className="w-5 h-5 text-[#f97316]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              Envío #{s.id.slice(-6)}
                            </span>
                            <Badge className={`${sc.color} text-[10px]`}>{sc.label}</Badge>
                          </div>
                          <p className="text-xs text-slate-500">{s.description ?? "Sin descripción"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#f97316]">
                          {s.fare != null
                            ? `$ ${Number(s.fare).toLocaleString("es-CO")}`
                            : <span className="text-sm text-slate-400">Sin tarifa</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.weight_kg != null ? `${s.weight_kg} kg` : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 font-medium">REMITENTE</div>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-700">{s.sender_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-600">{s.sender_phone}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5" />
                          <span className="text-xs text-slate-600">{s.pickup_address}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 font-medium">DESTINATARIO</div>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-700">{s.receiver_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-600">{s.receiver_phone}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5" />
                          <span className="text-xs text-slate-600">{s.delivery_address}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress */}
                    {s.status !== "cancelled" && (
                      <div className="mb-3">
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between mt-1">
                          {STEPS.map((step, i) => (
                            <span key={step}
                              className={`text-[10px] ${i <= sc.step ? "text-[#f97316] font-medium" : "text-slate-400"}`}>
                              {step}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="text-xs text-slate-600">
                        {s.driver_id
                          ? `Conductor asignado`
                          : <span className="text-amber-600">Sin conductor</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <Camera className="w-3.5 h-3.5 mr-1" />
                          Fotos ({s.photos?.length ?? 0})
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <Mic className="w-3.5 h-3.5 mr-1" />
                          Voz ({s.voice_commands?.length ?? 0})
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}