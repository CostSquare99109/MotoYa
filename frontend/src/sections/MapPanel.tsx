import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Zap, Phone, Star, Navigation2, X, Locate } from "lucide-react";
import type { NearbyDriver } from "@/types";

/* ─── Leaflet loader ────────────────────────────────────────────── */
let leafletReady = false;
let heatReady = false;

function loadLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    if (leafletReady) { resolve(); return; }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => {
        leafletReady = true;
        const heat = document.createElement("script");
        heat.id = "leaflet-heat-js";
        heat.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
        heat.onload = () => { heatReady = true; resolve(); };
        heat.onerror = () => resolve();
        document.head.appendChild(heat);
      };
      document.head.appendChild(script);
    } else {
      resolve();
    }
  });
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const API = import.meta.env.VITE_API_URL ?? "";

/* ─── Component ─────────────────────────────────────────────────── */
export default function MapPanel() {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [selected, setSelected] = useState<NearbyDriver | null>(null);
  const [ready, setReady] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [demandZones, setDemandZones] = useState<{ lat: number; lng: number; intensity: number }[]>([]);

  /* ── Fetch drivers cercanos — endpoint correcto: /api/dispatch/nearby ── */
  useEffect(() => {
    async function fetchDrivers() {
      try {
        const res = await fetch(`${API}/api/dispatch/nearby`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: NearbyDriver[] = await res.json();
        setDrivers(data);
      } catch (err) {
        console.warn("No se pudo cargar conductores cercanos:", err);
      }
    }
    fetchDrivers();
    const interval = setInterval(fetchDrivers, 30_000);
    return () => clearInterval(interval);
  }, []);

  /* ── Fetch heatmap de demanda — endpoint correcto: /api/dispatch/heatmap ── */
  useEffect(() => {
    async function fetchZones() {
      try {
        const res = await fetch(`${API}/api/dispatch/heatmap`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { lat: number; lng: number; intensity: number }[] = await res.json();
        setDemandZones(data);
      } catch (err) {
        console.warn("No se pudo cargar zonas de demanda:", err);
      }
    }
    fetchZones();
    const interval = setInterval(fetchZones, 60_000);
    return () => clearInterval(interval);
  }, []);

  /* ── Calcular centro del mapa ── */
  useEffect(() => {
    if (drivers.length > 0 && !mapCenter) {
      const online = drivers.filter((d) => d.is_online);
      const source = online.length > 0 ? online : drivers;
      const avgLat = source.reduce((s, d) => s + d.current_location.lat, 0) / source.length;
      const avgLng = source.reduce((s, d) => s + d.current_location.lng, 0) / source.length;
      setMapCenter({ lat: avgLat, lng: avgLng });
    }
  }, [drivers, mapCenter]);

  /* ── Init map ── */
  useEffect(() => {
    loadLeaflet().then(() => {
      if (!mapRef.current || instanceRef.current) return;
      const L = (window as any).L;
      const center = mapCenter ?? { lat: 7.7667, lng: -76.6550 };
      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19 }
      ).addTo(map);
      L.control.attribution({ prefix: false, position: "bottomright" })
        .addAttribution("© OpenStreetMap | MotoYa").addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      instanceRef.current = map;
      setReady(true);
    });
    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, [mapCenter]);

  /* ── Heatmap layer ── */
  useEffect(() => {
    if (!ready || demandZones.length === 0) return;
    const L = (window as any).L;
    const map = instanceRef.current;
    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (showHeatmap && heatReady && L.heatLayer) {
      const points = demandZones.map((z) => [z.lat, z.lng, z.intensity / 10]);
      heatLayerRef.current = L.heatLayer(points, {
        radius: 50, blur: 30, maxZoom: 18,
        gradient: { 0.2: "#fef3c7", 0.5: "#f97316", 0.8: "#dc2626" },
      }).addTo(map);
    }
  }, [ready, showHeatmap, demandZones]);

  /* ── Driver markers ── */
  useEffect(() => {
    if (!ready) return;
    const L = (window as any).L;
    const map = instanceRef.current;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    if (!showDrivers) return;

    drivers.forEach((driver) => {
      const color = driver.is_online ? "#f97316" : "#94a3b8";
      const initials = driver.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
      const icon = L.divIcon({
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        html: `
          <div style="
            width:36px;height:36px;border-radius:50%;
            background:${color};border:3px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:12px;color:#fff;
            font-family:system-ui,sans-serif;position:relative;
          ">
            ${initials}
            <div style="
              position:absolute;bottom:-2px;right:-2px;
              width:11px;height:11px;border-radius:50%;
              background:${driver.is_online ? "#10b981" : "#94a3b8"};
              border:2px solid #fff;
            "></div>
          </div>
          <div style="
            position:absolute;top:-6px;left:50%;transform:translateX(-50%);
            background:${color};color:#fff;
            font-size:9px;font-weight:700;padding:1px 5px;border-radius:9px;
            font-family:system-ui,sans-serif;white-space:nowrap;
            box-shadow:0 1px 4px rgba(0,0,0,0.2);
          ">★ ${driver.rating}</div>
        `,
      });
      const marker = L.marker([driver.current_location.lat, driver.current_location.lng], { icon }).addTo(map);
      marker.on("click", () => setSelected(driver));
      markersRef.current.push(marker);
    });

    demandZones.slice(0, 3).forEach((zone, i) => {
      const icon = L.divIcon({
        className: "", iconSize: [28, 36], iconAnchor: [14, 36],
        html: `
          <div style="position:relative;width:28px;height:36px;">
            <div style="
              width:28px;height:28px;border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);background:#10b981;
              border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);
            "></div>
            <div style="
              position:absolute;top:4px;left:4px;width:20px;height:20px;
              display:flex;align-items:center;justify-content:center;
              color:#fff;font-weight:700;font-size:11px;font-family:system-ui,sans-serif;
            ">${i + 1}</div>
          </div>
        `,
      });
      const m = L.marker([zone.lat, zone.lng], { icon }).addTo(map);
      markersRef.current.push(m);
    });
  }, [ready, showDrivers, drivers, demandZones]);

  const recenter = () => {
    if (mapCenter) instanceRef.current?.setView([mapCenter.lat, mapCenter.lng], 15, { animate: true });
  };

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Top controls */}
      <div className="absolute top-3 left-3 z-[999] flex gap-2">
        <Button
          size="sm"
          onClick={() => setShowHeatmap((v) => !v)}
          className={showHeatmap
            ? "bg-[#f97316] hover:bg-[#ea580c] shadow-md text-white"
            : "bg-white hover:bg-slate-100 text-slate-700 shadow-md border border-slate-200"}
        >
          <Zap className="w-4 h-4 mr-1.5" />Heatmap
        </Button>
        <Button
          size="sm"
          onClick={() => setShowDrivers((v) => !v)}
          className={showDrivers
            ? "bg-[#0f172a] hover:bg-[#1e293b] shadow-md text-white"
            : "bg-white hover:bg-slate-100 text-slate-700 shadow-md border border-slate-200"}
        >
          <Layers className="w-4 h-4 mr-1.5" />Conductores
        </Button>
      </div>

      {/* Recenter */}
      <button
        onClick={recenter}
        className="absolute top-3 right-3 z-[999] w-9 h-9 bg-white rounded-full shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
      >
        <Locate className="w-4 h-4 text-slate-600" />
      </button>

      {/* Legend */}
      <div className="absolute bottom-12 left-3 z-[999] bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 space-y-1.5 border border-slate-100">
        <div className="text-xs font-bold text-slate-700 mb-2">Leyenda</div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="w-3 h-3 rounded-full bg-[#f97316] ring-2 ring-[#f97316]/30" />
          <span>Conductor activo</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          <span>Conductor inactivo</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="w-3 h-3 rounded-full bg-[#10b981]" />
          <span>Punto de recogida</span>
        </div>
        {showHeatmap && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-amber-200 to-red-500" />
            <span>Zona de demanda</span>
          </div>
        )}
      </div>

      {/* Driver popup */}
      {selected && (
        <div className="absolute bottom-12 right-3 z-[999] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 w-56 animate-in slide-in-from-right-2">
          <button onClick={() => setSelected(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {selected.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm leading-tight">{selected.full_name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-xs text-slate-500">{selected.rating}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge className={selected.is_online
                ? "bg-emerald-100 text-emerald-700 text-[10px] px-2"
                : "bg-slate-100 text-slate-500 text-[10px] px-2"}>
                {selected.is_online ? "● Online" : "● Offline"}
              </Badge>
              <span className="text-xs text-slate-500">
                {selected.distance_meters >= 1000
                  ? `${(selected.distance_meters / 1000).toFixed(1)} km`
                  : `${selected.distance_meters} m`}
              </span>
            </div>
            <a
              href={`tel:${selected.phone}`}
              className="flex items-center gap-2 w-full px-3 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />{selected.phone}
            </a>
            <button className="flex items-center gap-2 w-full px-3 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg text-xs font-medium transition-colors">
              <Navigation2 className="w-3.5 h-3.5" />Asignar viaje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
