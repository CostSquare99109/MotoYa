import { Navigate, useLocation } from 'react-router';
import type { UserRole } from '@/types';
import { useRoles } from '@/hooks/useRoles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Rol o roles permitidos para esta ruta */
  allowedRoles?: UserRole | UserRole[];
  /** Si no tiene acceso, a dónde redirigir (por defecto: login del rol) */
  redirectTo?: string;
}

/**
 * Guarda de ruta con redirección inteligente por rol.
 *
 * - Si no está autenticado → redirige al login según el portal.
 * - Si tiene sesión pero rol incorrecto → redirige a su home.
 */
export default function ProtectedRoute({
  children,
  allowedRoles,
  redirectTo,
}: ProtectedRouteProps) {
  const { isAuthenticated, role, homeRoute, loginRoute } = useRoles();
  const location = useLocation();

  // No autenticado
  if (!isAuthenticated) {
    // Inferir portal desde la URL actual
    let targetLogin: string;
    if (redirectTo) {
      targetLogin = redirectTo;
    } else if (location.pathname.startsWith('/worker')) {
      targetLogin = '/worker/login';
    } else if (location.pathname.startsWith('/client')) {
      targetLogin = '/client/login';
    } else {
      targetLogin = loginRoute();
    }
    return <Navigate to={targetLogin} replace state={{ from: location }} />;
  }

  // Autenticado pero sin el rol necesario
  if (allowedRoles) {
    const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (role && !allowed.includes(role)) {
      return <Navigate to={redirectTo ?? homeRoute()} replace />;
    }
  }

  return <>{children}</>;
}
