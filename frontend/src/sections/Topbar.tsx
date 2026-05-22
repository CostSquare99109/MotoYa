import { useState, useEffect, useCallback } from "react";
import { Bell, Search, MapPin, X, Check, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/useStore";
import { useNotifications, type Notification } from "@/hooks/useNotifications";

interface TopbarProps {
  sidebarCollapsed: boolean;
}

export default function Topbar({ sidebarCollapsed }: TopbarProps) {
  const { user, drivers } = useStore();
  const { notifications, unreadCount, markRead, markAllRead, removeNotification, refresh } = useNotifications();
  const [open, setOpen] = useState(false);

  const onlineCount = drivers.filter((d) => d.is_online).length;
  const displayName = user?.full_name ?? user?.username ?? "Usuario";
  const initials = displayName.charAt(0).toUpperCase();

  // Refrescar notificaciones cada 30s
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "emergency": return "🔴";
      case "trip": return "🏍️";
      case "system": return "⚙️";
      default: return "📌";
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "emergency": return "border-l-red-500";
      case "trip": return "border-l-orange-500";
      default: return "border-l-blue-500";
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar conductor, viaje, direccion..."
            className="pl-9 w-72 h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm dark:text-slate-200"
          />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <MapPin className="w-4 h-4 text-[#f97316]" />
          <span>Carepa, Antioquia</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs">
            {onlineCount} Online
          </Badge>
        </div>

        {/* ── Campana de notificaciones ── */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            onClick={() => setOpen(!open)}
          >
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {/* ── Dropdown de notificaciones ── */}
          {open && (
            <>
              {/* Backdrop para cerrar */}
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-12 w-96 max-h-[480px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Notificaciones
                    {unreadCount > 0 && (
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                        ({unreadCount} sin leer)
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-600 hover:text-orange-700" onClick={markAllRead}>
                        <Check className="w-3 h-3 mr-1" /> Leer todo
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-auto scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                      No hay notificaciones
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-l-4 ${typeColor(n.type)} ${
                          !n.read ? "bg-orange-50/50 dark:bg-orange-950/20" : "bg-white dark:bg-slate-900"
                        } border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{typeIcon(n.type)}</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                {n.title}
                              </span>
                              {!n.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                              {new Date(n.created_at).toLocaleString("es-CO", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => markRead(n.id)}
                                title="Marcar como leída"
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeNotification(n.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{displayName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role ?? "Admin"}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-sm font-bold">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
