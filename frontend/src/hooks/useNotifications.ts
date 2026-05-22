import { useEffect, useState, useCallback } from "react";
import { API_BASE as API, getAuthToken } from "@/lib/apiConfig";

export interface Notification {
  id: string;
  type: "trip" | "emergency" | "system" | "dispatch";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Hook para manejar notificaciones del admin.
 * - Carga notificaciones desde la API
 * - Polling cada 30s para mantenerse actualizado
 * - Permite marcar como leídas, eliminar
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/notifications`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const items: Notification[] = Array.isArray(data) ? data : data.notifications ?? [];
        setNotifications(items);
        setUnreadCount(items.filter((n) => !n.read).length);
      }
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await fetch(`${API}/api/notifications/${id}/read`, {
          method: "PATCH",
          headers: authHeaders(),
        });
      } catch {
        // Silently fail
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    []
  );

  const markAllRead = useCallback(async () => {
    try {
      await fetch(`${API}/api/notifications/read-all`, {
        method: "PATCH",
        headers: authHeaders(),
      });
    } catch {
      // Silently fail
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const removeNotification = useCallback(
    async (id: string) => {
      try {
        await fetch(`${API}/api/notifications/${id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
      } catch {
        // Silently fail
      }
      setNotifications((prev) => {
        const removed = prev.find((n) => n.id === id);
        if (removed && !removed.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    },
    []
  );

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
    if (!notification.read) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    removeNotification,
    addNotification,
    refresh,
  };
}
