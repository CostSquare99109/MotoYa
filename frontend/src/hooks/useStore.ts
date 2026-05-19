import { useState, useEffect, useCallback } from "react";
import type { Driver, Trip, NearbyDriver, HeatmapData, RankingEntry } from "@/types";

// Coordenadas de Carepa, Antioquia, Colombia
const CAREPA_CENTER: [number, number] = [7.7622, -76.6569];

/** Safe localStorage.getItem — returns null if localStorage is unavailable. */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage.setItem — silently fails if localStorage is unavailable. */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing or quota exceeded — ignore
  }
}

/** Safe localStorage.removeItem — silently fails if localStorage is unavailable. */
function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Safe JSON.parse — returns fallback on error. */
function safeJsonParse<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// Estado global compartido entre todos los hooks useStore()
let globalState = {
  token: safeGetItem("token"),
  user: safeJsonParse<Record<string, unknown> | null>(safeGetItem("user"), null),
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
      if (t) safeSetItem("token", t);
      else safeRemoveItem("token");
      globalState.token = t;
      emitChange();
    },

    setUser: (u: typeof globalState.user) => {
      if (u) safeSetItem("user", JSON.stringify(u));
      else safeRemoveItem("user");
      globalState.user = u;
      emitChange();
    },

    logout: () => {
      safeRemoveItem("token");
      safeRemoveItem("user");
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
