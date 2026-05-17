import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard, ClipboardList, Users, Bike,
  Package, Trophy, Settings, LogOut, ChevronLeft, ChevronRight,
  Map, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/useStore";
import { useRoles } from "@/hooks/useRoles";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  exact?: boolean;
}

// Items visibles para el rol admin
const ADMIN_ITEMS: NavItem[] = [
  { label: "Panel",        icon: LayoutDashboard, path: "/",           exact: true },
  { label: "Solicitudes",  icon: ClipboardList,   path: "/shipments" },
  { label: "Conductores",  icon: Users,           path: "/drivers" },
  { label: "Flota",        icon: Bike,            path: "/fleet" },
  { label: "Mapa en vivo", icon: Map,             path: "/live-map" },
  { label: "Usuarios",     icon: ShieldCheck,     path: "/users" },
  { label: "Finanzas",     icon: Trophy,          path: "/finances" },
  { label: "Configuración",icon: Settings,        path: "/settings" },
];

// Items para worker (usado cuando hay portal de worker dentro del layout admin)
const WORKER_ITEMS: NavItem[] = [
  { label: "Dashboard",   icon: LayoutDashboard, path: "/worker",         exact: true },
  { label: "Mi perfil",   icon: Users,           path: "/worker/profile" },
  { label: "Historial",   icon: ClipboardList,   path: "/worker/history" },
  { label: "Configuración",icon: Settings,       path: "/settings" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useStore();
  const { isAdmin, isWorker, role } = useRoles();

  const navItems = isWorker ? WORKER_ITEMS : ADMIN_ITEMS;

  const handleLogout = () => {
    logout();
    // Redirect to the correct login portal
    if (isWorker) navigate("/worker/login");
    else navigate("/login");
  };

  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path) && item.path !== "/";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#0f172a] text-white transition-all duration-300 z-50 flex-shrink-0",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#f97316] flex items-center justify-center flex-shrink-0">
            <Bike className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-bold text-lg tracking-tight truncate block">MotoYa</span>
              {role && (
                <span className="text-[10px] text-slate-400 capitalize truncate block leading-tight">
                  {role === "admin" ? "Administrador" : role === "worker" ? "Conductor" : "Pasajero"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.path + item.label}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                active
                  ? "bg-[#f97316] text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {/* Badge for live map — dot indicator */}
              {!collapsed && item.path === "/live-map" && (
                <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-white/10 space-y-0.5">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all w-full"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Colapsar</span>
            </>
          )}
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 transition-all w-full"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Salir</span>}
        </button>
      </div>
    </aside>
  );
}
