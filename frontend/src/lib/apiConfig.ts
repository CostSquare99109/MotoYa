/**
 * Centralized API configuration.
 * All API/WS base URLs should come from this module — never hardcode in components.
 */

/** REST API base URL. MUST be set via VITE_API_URL in .env */
export const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

/** WebSocket base URL. Derived from VITE_API_URL or set via VITE_WS_URL */
export const WS_BASE: string = (
  import.meta.env.VITE_WS_URL ??
  (API_BASE
    ? API_BASE.replace(/^http/, "ws")
    : "")
).replace(/\/$/, "");

/** Helper to build API fetch URLs */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** Safe localStorage token getter — won't crash in private browsing. */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

/** Build Authorization headers for fetch calls. */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
