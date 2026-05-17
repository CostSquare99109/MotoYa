import { useStore } from './useStore';
import type { UserRole } from '@/types';

/**
 * Exposes helpers de rol para guardas de rutas y renderizado condicional.
 *
 * Uso:
 *   const { isAdmin, isWorker, isClient, hasRole } = useRoles();
 */
export function useRoles() {
  const { user } = useStore();

  const role: UserRole | null = (user?.role as UserRole) ?? null;

  return {
    role,
    isAdmin: role === 'admin',
    isWorker: role === 'worker',
    isClient: role === 'client',
    isAuthenticated: !!user,
    hasRole: (r: UserRole | UserRole[]) => {
      if (!role) return false;
      return Array.isArray(r) ? r.includes(role) : role === r;
    },
    /** Retorna la ruta home según el rol autenticado */
    homeRoute: () => {
      switch (role) {
        case 'admin':  return '/';
        case 'worker': return '/worker';
        case 'client': return '/client';
        default:       return '/login';
      }
    },
    /** Retorna la ruta de login según el rol (para redirects inteligentes) */
    loginRoute: (targetRole?: UserRole) => {
      switch (targetRole ?? role) {
        case 'worker': return '/worker/login';
        case 'client': return '/client/login';
        default:       return '/login';
      }
    },
  };
}
