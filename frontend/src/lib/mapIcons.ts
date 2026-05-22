/* ─── MapIcons — Iconos SVG estilo Google Maps para Leaflet ────────────── */

/**
 * Conductor mototaxi — icono tipo "ride-hailing" con indicador de estado.
 * Inspirado en los marcadores de Uber/Google Maps.
 */
export function driverIcon(opts: {
  online: boolean;
  initials?: string;
  rating?: number;
  heading?: number; // grados 0-360
}) {
  const { online, initials = "🏍", rating, heading } = opts;
  const bg = online ? "#1a1a2e" : "#64748b";
  const border = online ? "#f97316" : "#94a3b8";
  const statusDot = online ? "#10b981" : "#94a3b8";

  const rotation = heading != null ? `transform:rotate(${heading}deg);` : "";

  const html = `
    <div style="position:relative;width:44px;height:56px;">
      <!-- Sombra del marcador -->
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:18px;height:6px;border-radius:50%;background:rgba(0,0,0,0.25);
        filter:blur(2px);"></div>
      <!-- Pin estilo Google Maps -->
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);
        width:44px;height:44px;">
        <!-- Círculo principal -->
        <div style="width:44px;height:44px;border-radius:50%;
          background:${bg};border:3px solid ${border};
          box-shadow:0 3px 14px rgba(0,0,0,0.35),0 0 0 1px rgba(255,255,255,0.1);
          display:flex;align-items:center;justify-content:center;
          font-weight:800;font-size:${initials.length > 2 ? 11 : 14}px;color:#fff;
          font-family:'Inter',system-ui,sans-serif;${rotation}">
          ${heading != null ? "▶" : initials}
        </div>
        <!-- Punta del pin -->
        <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:8px solid transparent;border-right:8px solid transparent;
          border-top:10px solid ${bg};"></div>
        <!-- Indicador online/offline -->
        <div style="position:absolute;bottom:4px;right:2px;
          width:13px;height:13px;border-radius:50%;
          background:${statusDot};border:2.5px solid #fff;
          box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
      </div>
      ${rating != null ? `
      <!-- Badge rating -->
      <div style="position:absolute;top:-4px;left:50%;transform:translateX(-50%);
        background:#f97316;color:#fff;font-size:9px;font-weight:800;
        padding:1px 6px;border-radius:10px;white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.25);
        font-family:'Inter',system-ui,sans-serif;">
        ★ ${rating.toFixed(1)}
      </div>` : ""}
    </div>`;

  return {
    html,
    className: "",
    iconSize: [44, 56] as [number, number],
    iconAnchor: [22, 56] as [number, number],
    popupAnchor: [0, -56] as [number, number],
  };
}

/**
 * Punto de recogida — pin verde estilo Google Maps con "A" o ícono.
 */
export function pickupIcon(label = "A") {
  const html = `
    <div style="position:relative;width:36px;height:46px;">
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:14px;height:5px;border-radius:50%;background:rgba(0,0,0,0.2);
        filter:blur(1.5px);"></div>
      <div style="width:36px;height:36px;border-radius:50% 50% 50% 4px;
        transform:rotate(-45deg);background:#22c55e;
        border:3px solid #fff;box-shadow:0 3px 14px rgba(34,197,94,0.45);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);color:#fff;font-weight:900;
          font-size:13px;font-family:'Inter',system-ui,sans-serif;">${label}</span>
      </div>
    </div>`;

  return {
    html,
    className: "",
    iconSize: [36, 46] as [number, number],
    iconAnchor: [18, 46] as [number, number],
    popupAnchor: [0, -46] as [number, number],
  };
}

/**
 * Punto de destino — pin rojo estilo Google Maps con "B" o ícono.
 */
export function dropoffIcon(label = "B") {
  const html = `
    <div style="position:relative;width:36px;height:46px;">
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:14px;height:5px;border-radius:50%;background:rgba(0,0,0,0.2);
        filter:blur(1.5px);"></div>
      <div style="width:36px;height:36px;border-radius:50% 50% 50% 4px;
        transform:rotate(-45deg);background:#ef4444;
        border:3px solid #fff;box-shadow:0 3px 14px rgba(239,68,68,0.45);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);color:#fff;font-weight:900;
          font-size:13px;font-family:'Inter',system-ui,sans-serif;">${label}</span>
      </div>
    </div>`;

  return {
    html,
    className: "",
    iconSize: [36, 46] as [number, number],
    iconAnchor: [18, 46] as [number, number],
    popupAnchor: [0, -46] as [number, number],
  };
}

/**
 * Marcador de zona de demanda — pin naranja.
 */
export function demandIcon(index: number) {
  const html = `
    <div style="position:relative;width:32px;height:42px;">
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:12px;height:4px;border-radius:50%;background:rgba(0,0,0,0.2);
        filter:blur(1.5px);"></div>
      <div style="width:32px;height:32px;border-radius:50% 50% 50% 4px;
        transform:rotate(-45deg);background:#f97316;
        border:3px solid #fff;box-shadow:0 3px 10px rgba(249,115,22,0.5);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);color:#fff;font-weight:900;
          font-size:12px;font-family:'Inter',system-ui,sans-serif;">${index + 1}</span>
      </div>
    </div>`;

  return {
    html,
    className: "",
    iconSize: [32, 42] as [number, number],
    iconAnchor: [16, 42] as [number, number],
    popupAnchor: [0, -42] as [number, number],
  };
}

/* ─── Tile layers ──────────────────────────────────────────────────────── */

export const TILE_LAYERS = {
  /** Estilo Google Maps — roads + terrain */
  googleRoads: {
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "© Google Maps",
    maxZoom: 20,
  },
  /** Estilo Google Maps — satélite */
  googleSatellite: {
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "© Google Maps Satellite",
    maxZoom: 20,
  },
  /** Estilo Google Maps — híbrido (satélite + etiquetas) */
  googleHybrid: {
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "© Google Maps Hybrid",
    maxZoom: 20,
  },
  /** Estilo Google Maps — terreno */
  googleTerrain: {
    url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    attribution: "© Google Maps Terrain",
    maxZoom: 20,
  },
  /** CartoDB Voyager — limpio y moderno (fallback) */
  cartoVoyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap © CARTO",
    maxZoom: 19,
    subdomains: "abcd",
  },
  /** CartoDB Dark Matter — para modo oscuro */
  cartoDark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap © CARTO",
    maxZoom: 19,
    subdomains: "abcd",
  },
} as const;

export type TileLayerKey = keyof typeof TILE_LAYERS;
