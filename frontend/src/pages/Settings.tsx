import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
 Settings, Bell, Shield, MapPin, Save, Globe,
 Loader2, CheckCircle2,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

const defaultSettings = {
  general: {
    platformName: "MotoYa",
    city: "Carepa",
    department: "Antioquia",
    timezone: "america_bogota",
    currency: "cop",
    darkMode: false,
  },
  notifications: {
    newTrips: true,
    emergencies: true,
    maintenance: true,
    dailyReports: false,
  },
 security: {
 selfieValidation: true,
 emergencyStream: true,
 },
  dispatch: {
    searchRadius: 3,
    maxResponseTime: 5,
    autoAssign: true,
    voiceCommands: true,
  },
};

export default function SettingsPage() {
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedOk, setSavedOk] = useState(false);
 const [error, setError] = useState("");

 const [general, setGeneral] = useState(defaultSettings.general);
  const [notifications, setNotifications] = useState(defaultSettings.notifications);
  const [security, setSecurity]         = useState(defaultSettings.security);
  const [dispatch, setDispatch]         = useState(defaultSettings.dispatch);

  // ── Cargar configuración al montar ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/api/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.general)       setGeneral({ ...defaultSettings.general, ...data.general });
          if (data.notifications) setNotifications({ ...defaultSettings.notifications, ...data.notifications });
 if (data.security) {
 setSecurity({
 ...defaultSettings.security,
 selfieValidation: data.security.selfieValidation ?? true,
 emergencyStream: data.security.emergencyStream ?? true,
 });
          }
          if (data.dispatch)      setDispatch({ ...defaultSettings.dispatch, ...data.dispatch });
        }
      } catch {
        // usar defaults si no hay settings aún
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Guardar ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("token");

 const securityPayload: Record<string, unknown> = {
 selfieValidation: security.selfieValidation,
 emergencyStream: security.emergencyStream,
 };

 const payload = {
        general,
        notifications,
        security: securityPayload,
        dispatch,
      };

      const res = await fetch(`${API}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail || "Error al guardar");
      }

 setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#f97316]" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 h-full overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#f97316]" />
          Configuración
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Administra las preferencias de la plataforma MotoYa · Los cambios se guardan en la base de datos
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 max-w-4xl">

        {/* ── General ─────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#f97316]" />
              General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la plataforma</Label>
              <Input
                value={general.platformName}
                onChange={(e) => setGeneral({ ...general, platformName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input
                  value={general.city}
                  onChange={(e) => setGeneral({ ...general, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input
                  value={general.department}
                  onChange={(e) => setGeneral({ ...general, department: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Zona horaria</Label>
              <Select
                value={general.timezone}
                onValueChange={(v) => setGeneral({ ...general, timezone: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="america_lima">America/Lima (GMT-5)</SelectItem>
                  <SelectItem value="america_bogota">America/Bogota (GMT-5)</SelectItem>
                  <SelectItem value="america_mexico">America/Mexico City (GMT-6)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select
                value={general.currency}
                onValueChange={(v) => setGeneral({ ...general, currency: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pen">PEN (S/)</SelectItem>
                  <SelectItem value="usd">USD ($)</SelectItem>
                  <SelectItem value="cop">COP ($)</SelectItem>
                  <SelectItem value="mxn">MXN ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Modo oscuro</Label>
                <p className="text-xs text-slate-500">Cambiar tema de la interfaz</p>
              </div>
              <Switch
                checked={general.darkMode}
                onCheckedChange={(v) => setGeneral({ ...general, darkMode: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Notificaciones ───────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#f97316]" />
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {([
              { key: "newTrips",      label: "Nuevas solicitudes", desc: "Notificar cuando llegue un nuevo viaje" },
              { key: "emergencies",   label: "Emergencias",         desc: "Alertas de panic button y emergencias" },
              { key: "maintenance",   label: "Mantenimiento",       desc: "Recordatorios de mantenimiento de motos" },
              { key: "dailyReports",  label: "Reportes diarios",    desc: "Resumen de actividad al final del día" },
            ] as const).map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{item.label}</Label>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
                <Switch
                  checked={notifications[item.key]}
                  onCheckedChange={(v) => setNotifications({ ...notifications, [item.key]: v })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Seguridad ────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#f97316]" />
              Seguridad
            </CardTitle>
          </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
              <div>
                <Label>Validación de selfies</Label>
                <p className="text-xs text-slate-500">Requerir foto de verificación</p>
              </div>
              <Switch
                checked={security.selfieValidation}
                onCheckedChange={(v) => setSecurity({ ...security, selfieValidation: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Streaming de emergencia</Label>
                <p className="text-xs text-slate-500">Audio en tiempo real para emergencias</p>
              </div>
              <Switch
                checked={security.emergencyStream}
                onCheckedChange={(v) => setSecurity({ ...security, emergencyStream: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Despacho ─────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#f97316]" />
              Despacho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Radio de búsqueda (km)</Label>
              <Input
                type="number" min={1} max={10}
                value={dispatch.searchRadius}
                onChange={(e) => setDispatch({ ...dispatch, searchRadius: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tiempo máximo de respuesta (min)</Label>
              <Input
                type="number" min={1} max={15}
                value={dispatch.maxResponseTime}
                onChange={(e) => setDispatch({ ...dispatch, maxResponseTime: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-asignación</Label>
                <p className="text-xs text-slate-500">Asignar al conductor más cercano</p>
              </div>
              <Switch
                checked={dispatch.autoAssign}
                onCheckedChange={(v) => setDispatch({ ...dispatch, autoAssign: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Comandos de voz</Label>
                <p className="text-xs text-slate-500">Permitir comandos de voz</p>
              </div>
              <Switch
                checked={dispatch.voiceCommands}
                onCheckedChange={(v) => setDispatch({ ...dispatch, voiceCommands: v })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Botón guardar ───────────────────────────────────────────────── */}
      <div className="mt-6 max-w-4xl flex justify-end gap-3 items-center">
        {error && <span className="text-sm text-red-600">{error}</span>}
        {savedOk && (
          <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Configuración guardada
          </span>
        )}
        <Button onClick={handleSave} disabled={saving} className="bg-[#f97316] hover:bg-[#ea580c]">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Guardar cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
