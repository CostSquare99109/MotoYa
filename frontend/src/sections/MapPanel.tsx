import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers, Zap, Phone, Star, Navigation2, X,
  Locate, Map, Satellite, Mountain, ChevronDown,
} from "lucide-react";
import {
  driverIcon, pickupIcon, dropoffIcon, demandIcon,
  TILE_LAYERS, type TileLayerKey,
} from "@/lib/mapIcons";
import type { NearbyDriver } from "@/types";
import type * as L from "leaflet";
import { API_BASE as API, getAuthToken } from "@/lib/apiConfig";
import { useTheme } from "@/hooks/useTheme";

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
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ─── Layer selector config ──────────────────────────────────────── */
const LAYER_OPTIONS: { key: TileLayerKey; label: string; icon: React.ReactNode }[] = [
  { key: "googleRoads", label: "Callejero", icon: <Map className="w-3.5 h-3.5" /> },
  { key: "googleSatellite", label: "Satélite", icon: <Satellite className="w-3.5 h-3.5" /> },
  { key: "googleHybrid", label: "Híbrido", icon: <Layers className="w-3.5 h-3.5" /> },
  { key: "googleTerrain", label: "Terreno", icon: <Mountain className="w-3.5 h-3.5" /> },
];

/* ─── Component ─────────────────────────────────────────────────── */
export default function MapPanel() {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const { isDark } = useTheme();
  const [activeLayer, setActiveLayer] = useState<TileLayerKey>("googleRoads");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [selected, setSelected] = useState<NearbyDriver | null>(null);
  const [ready, setReady] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [demandZones, setDemandZones] = useState<{ lat: number; lng: number; intensity: number }[]>([]);

  /* ── Fetch drivers cercanos ── */
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

  /* ── Fetch heatmap de demanda ── */
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
      const L = window.L;
      const center = mapCenter ?? { lat: 7.7667, lng: -76.6550 };
      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      // Tile layer inicial
      const tileCfg = TILE_LAYERS[activeLayer];
      const tile = L.tileLayer(tileCfg.url, {
        attribution: tileCfg.attribution,
        maxZoom: tileCfg.maxZoom,
        ...(tileCfg.subdomains ? { subdomains: tileCfg.subdomains } : {}),
      }).addTo(map);
      tileLayerRef.current = tile;

      L.control.attribution({ prefix: false, position: "bottomright" })
        .addAttribution("© Google Maps | MotoYa").addTo(map);
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

  /* ── Cambiar tile layer ── */
  useEffect(() => {
    if (!ready) return;
    const L = window.L;
    const map = instanceRef.current;
    if (!map) return;

    // Si está en modo oscuro y no eligió satélite, usar dark tiles
    const effectiveKey: TileLayerKey =
      isDark && (activeLayer === "googleRoads")
        ? "cartoDark"
        : activeLayer;

    const tileCfg = TILE_LAYERS[effectiveKey];
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: tileCfg.maxZoom,
      ...(tileCfg.subdomains ? { subdomains: tileCfg.subdomains } : {}),
    }).addTo(map);
  }, [ready, activeLayer, isDark]);

  /* ── Heatmap layer ── */
  useEffect(() => {
    if (!ready || demandZones.length === 0) return;
    const L = window.L;
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
    const L = window.L;
    const map = instanceRef.current;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    if (!showDrivers) return;

    drivers.forEach((driver) => {
      const initials = driver.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
      const icon = L.divIcon(driverIcon({
        online: driver.is_online,
        initials,
        rating: driver.rating,
      }));
      const marker = L.marker([driver.current_location.lat, driver.current_location.lng], { icon }).addTo(map);
      marker.on("click", () => setSelected(driver));
      markersRef.current.push(marker);
    });

    demandZones.slice(0, 3).forEach((zone, i) => {
      const icon = L.divIcon(demandIcon(i));
      const m = L.marker([zone.lat, zone.lng], { icon }).addTo(map);
      markersRef.current.push(m);
    });
  }, [ready, showDrivers, drivers, demandZones]);

  const recenter = () => {
    if (mapCenter) instanceRef.current?.setView([mapCenter.lat, mapCenter.lng], 15, { animate: true });
  };

  const currentLayerLabel = LAYER_OPTIONS.find((l) => l.key === activeLayer)?.label ?? "Callejero";

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* ── Top controls ── */}
      <div className="absolute top-3 left-3 z-[999] flex gap-2">
        {/* Layer selector dropdown */}
        <div className="relative">
          <Button
            size="sm"
            onClick={() => setShowLayerMenu((v) => !v)}
            className="bg-white hover:bg-slate-50 text-slate-700 shadow-lg border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700 font-medium"
          >
            <Layers className="w-4 h-4 mr-1.5" />
            {currentLayerLabel}
            <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
          </Button>
          {showLayerMenu && (
            <div className="absolute top-full mt-1.5 left-0 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 py-1 min-w-[160px] z-[1000]">
              {LAYER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setActiveLayer(opt.key); setShowLayerMenu(false); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors
                    ${activeLayer === opt.key
                      ? "bg-orange-50 text-[#f97316] font-semibold dark:bg-orange-900/20 dark:text-orange-400"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                >
                  {opt.icon}
                  {opt.label}
                  {activeLayer === opt.key && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-[#f97316]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => setShowHeatmap((v) => !v)}
          className={showHeatmap
            ? "bg-[#f97316] hover:bg-[#ea580c] shadow-lg text-white"
            : "bg-white hover:bg-slate-100 text-slate-700 shadow-lg border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"}
        >
          <Zap className="w-4 h-4 mr-1.5" />Heatmap
        </Button>
        <Button
          size="sm"
          onClick={() => setShowDrivers((v) => !v)}
          className={showDrivers
            ? "bg-[#0f172a] hover:bg-[#1e293b] shadow-lg text-white"
            : "bg-white hover:bg-slate-100 text-slate-700 shadow-lg border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"}
        >
          <Navigation2 className="w-4 h-4 mr-1.5" />Conductores
        </Button>
      </div>

      {/* ── Recenter button ── */}
      <button
        onClick={recenter}
        className="absolute top-3 right-3 z-[999] w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
      >
        <Locate className="w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:text-[#f97316] transition-colors" />
      </button>

      {/* ── Legend ── */}
      <div className="absolute bottom-12 left-3 z-[999] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-lg p-3 space-y-1.5 border border-slate-100 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Leyenda</div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="w-3 h-3 rounded-full bg-[#1a1a2e] ring-2 ring-[#f97316]/40" />
          <span>Conductor activo</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          <span>Conductor inactivo</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
          <span>Punto de recogida</span>
        </div>
        {showHeatmap && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-amber-200 to-red-500" />
            <span>Zona de demanda</span>
          </div>
        )}
      </div>

      {/* ── Driver popup ── */}
      {selected && (
        <div className="absolute bottom-12 right-3 z-[999] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-600 p-4 w-64 animate-in slide-in-from-right-2">
          <button onClick={() => setSelected(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#0f172a] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md">
              {selected.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight">{selected.full_name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-xs text-slate-500 dark:text-slate-400">{selected.rating}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge className={selected.is_online
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-2"
                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 text-[10px] px-2"}>
                {selected.is_online ? "● Online" : "● Offline"}
              </Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selected.distance_meters >= 1000
                  ? `${(selected.distance_meters / 1000).toFixed(1)} km`
                  : `${selected.distance_meters} m`}
              </span>
            </div>
            <a
              href={`tel:${selected.phone}`}
              className="flex items-center gap-2 w-full px-3 py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
            >
              <Phone className="w-3.5 h-3.5" />{selected.phone}
            </a>
            <button className="flex items-center gap-2 w-full px-3 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-xl text-xs font-semibold transition-colors shadow-sm">
              <Navigation2 className="w-3.5 h-3.5" />Asignar viaje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
