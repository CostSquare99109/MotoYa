/**
 * Type declarations for global objects loaded via CDN script tags.
 * Leaflet is loaded from CDN in index.html, so we declare it on window.
 */

interface LeafletGlobal {
  L: typeof import('leaflet');
}

declare global {
  interface Window {
    L: LeafletGlobal['L'];
  }
}

export {};
