import { useEffect, useState, useCallback } from "react";

/**
 * Hook para manejar el modo oscuro.
 * - Agrega/remueve la clase "dark" en <html>
 * - Persiste en localStorage
 * - Respeta la preferencia del sistema como fallback
 * - Retorna isDark como estado reactivo
 */
export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem("motoya-dark-mode");
      if (val !== null) return val === "true";
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  const applyTheme = useCallback((dark: boolean) => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("motoya-dark-mode", String(dark));
    } catch {}
  }, []);

  const setDarkMode = useCallback(
    (enabled: boolean) => {
      applyTheme(enabled);
      setIsDark(enabled);
    },
    [applyTheme]
  );

  // Aplicar tema al montar
  useEffect(() => {
    applyTheme(isDark);
  }, [applyTheme, isDark]);

  return { isDark, setDarkMode };
}
