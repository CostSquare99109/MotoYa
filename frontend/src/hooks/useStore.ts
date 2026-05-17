import { useState, useEffect, useCallback } from "react";
import type { Driver, Trip, NearbyDriver, HeatmapData, RankingEntry } from "@/types";

// Coordenadas de Carepa, Antioquia, Colombia
const CAREPA_CENTER: [number, number] = [7.7622, -76.6569];

// Estado global compartido entre todos los hooks useStore()
let globalState = {
  token: localStorage.getItem("token"),
  user: JSON.parse(localStorage.getItem("user") || "null"),
  mapCenter: CAREPA_CENTER as [number, number],
  selectedDriver: null as Driver | null,
  drivers: [] as Driver[],
  trips: [] as Trip[],
  nearbyDrivers: [] as NearbyDriver[],
  heatmapData: null as HeatmapData | null,
  rankings: [] as RankingEntry[],
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((fn) => fn());
}

export function useStore() {
  const [, setTick] = useState(0);

  // ✅ Corrección: suscripción en useEffect, no en useState
  // El bug anterior usaba useState(() => subscribe()) que no ejecuta limpieza
  // correctamente, provocando fugas de memoria y listeners huérfanos.
  const subscribe = useCallback(() => {
    const callback = () => setTick((t) => t + 1);
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe();
    return unsubscribe;
  }, [subscribe]);

  return {
    ...globalState,

    setToken: (t: string | null) => {
      if (t) localStorage.setItem("token", t);
      else localStorage.removeItem("token");
      globalState.token = t;
      emitChange();
    },

    setUser: (u: typeof globalState.user) => {
      if (u) localStorage.setItem("user", JSON.stringify(u));
      else localStorage.removeItem("user");
      globalState.user = u;
      emitChange();
    },

    logout: () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      globalState.token = null;
      globalState.user = null;
      emitChange();
    },

    setMapCenter: (c: [number, number]) => {
      globalState.mapCenter = c;
      emitChange();
    },

    setSelectedDriver: (d: Driver | null) => {
      globalState.selectedDriver = d;
      emitChange();
    },

    setDrivers: (d: Driver[]) => {
      globalState.drivers = d;
      emitChange();
    },

    setTrips: (t: Trip[]) => {
      globalState.trips = t;
      emitChange();
    },

    setNearbyDrivers: (d: NearbyDriver[]) => {
      globalState.nearbyDrivers = d;
      emitChange();
    },

    setHeatmapData: (h: HeatmapData | null) => {
      globalState.heatmapData = h;
      emitChange();
    },

    setRankings: (r: RankingEntry[]) => {
      globalState.rankings = r;
      emitChange();
    },
  };
}
