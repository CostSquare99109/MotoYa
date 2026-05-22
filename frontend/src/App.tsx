import { Routes, Route, Navigate } from "react-router";
import { useState } from "react";

// Layout components
import Sidebar from "./sections/Sidebar";
import Topbar from "./sections/Topbar";

// Guards
import ProtectedRoute from "./components/ProtectedRoute";

// ─── Admin / Backoffice pages ─────────────────────────────────────────────────
import Dashboard    from "./pages/Dashboard";
import Drivers      from "./pages/Drivers";
import Fleet        from "./pages/Fleet";
import Shipments    from "./pages/Shipments";
import Finances     from "./pages/Finances";
import SettingsPage from "./pages/Settings";
import LoginPage    from "./pages/Login";
import LiveMap      from "./pages/LiveMap";
import UsersPage    from "./pages/Users";

// ─── Worker / Conductor pages ─────────────────────────────────────────────────
import WorkerLogin     from "./pages/worker/WorkerLogin";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import WorkerProfile   from "./pages/worker/WorkerProfile";

// ─── Client / Pasajero pages ──────────────────────────────────────────────────
import ClientLogin  from "./pages/client/ClientLogin";
import ClientHome   from "./pages/client/ClientHome";
import TrackTrip    from "./pages/client/TrackTrip";
import TripHistory  from "./pages/client/TripHistory";

// ─── Layouts ──────────────────────────────────────────────────────────────────

/** Layout del backoffice admin con sidebar + topbar */
function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] dark:bg-slate-950">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar sidebarCollapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <Routes>

      {/* ══════════════════════════════════════════════
          PORTAL ADMIN  →  /login, /*, /live-map, /users
         ══════════════════════════════════════════════ */}
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute allowedRoles="admin">
            <AdminLayout>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="drivers"   element={<Drivers />} />
                <Route path="fleet"     element={<Fleet />} />
                <Route path="shipments" element={<Shipments />} />
                <Route path="finances"  element={<Finances />} />
                <Route path="settings"  element={<SettingsPage />} />
                <Route path="live-map"  element={<LiveMap />} />
                <Route path="users"     element={<UsersPage />} />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* ══════════════════════════════════════════════
          PORTAL CONDUCTOR  →  /worker/*
         ══════════════════════════════════════════════ */}
      <Route path="/worker/login" element={<WorkerLogin />} />

      <Route
        path="/worker/*"
        element={
          <ProtectedRoute allowedRoles="worker">
            <Routes>
              <Route index element={<WorkerDashboard />} />
              <Route path="profile" element={<WorkerProfile />} />
              {/* Redirect unknown worker routes back to dashboard */}
              <Route path="*" element={<Navigate to="/worker" replace />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* ══════════════════════════════════════════════
          PORTAL CLIENTE / PASAJERO  →  /client/*
         ══════════════════════════════════════════════ */}
      <Route path="/client/login" element={<ClientLogin />} />

      <Route
        path="/client/*"
        element={
          <ProtectedRoute allowedRoles="client">
            <Routes>
              <Route index element={<ClientHome />} />
              <Route path="track/:tripId" element={<TrackTrip />} />
              <Route path="history"       element={<TripHistory />} />
              {/* Redirect unknown client routes back to home */}
              <Route path="*" element={<Navigate to="/client" replace />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* ══════════════════════════════════════════════
          ROOT fallback — redirige según rol (o a /login)
         ══════════════════════════════════════════════ */}
      <Route path="*" element={<Navigate to="/login" replace />} />

    </Routes>
  );
}

export default App;
