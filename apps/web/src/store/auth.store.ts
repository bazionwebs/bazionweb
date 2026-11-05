import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  keycloakId: string;
  company?: string;
  phone?: string;
  website?: string;
  subscriptionStatus?: 'ACTIVE' | 'PENDING' | 'NONE';
}

function decodeJwtPayload(token: string | null): Record<string, any> | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json =
      typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function normalizeSessionUser(
  user: Partial<AuthUser> | null | undefined,
  accessToken: string | null,
): AuthUser | null {
  const decoded = decodeJwtPayload(accessToken);
  if (!user && !decoded) return null;

  const jwtRoles: string[] = Array.isArray(decoded?.realm_access?.roles)
    ? decoded.realm_access.roles
    : [];
  const rawRoles = Array.isArray(user?.roles)
    ? user.roles
    : typeof (user as any)?.role === 'string'
      ? [(user as any).role]
      : [];
  const roles = rawRoles.length > 0 ? rawRoles : jwtRoles.length > 0 ? jwtRoles : ['CLIENT'];

  return {
    id: user?.id || decoded?.sub || '',
    email: user?.email || decoded?.email || '',
    firstName: user?.firstName ?? decoded?.given_name ?? '',
    lastName: user?.lastName ?? decoded?.family_name ?? '',
    roles,
    keycloakId: user?.keycloakId || decoded?.sub || user?.id || '',
    ...(user?.company ? { company: user.company } : {}),
    ...(user?.phone ? { phone: user.phone } : {}),
    ...(user?.website ? { website: user.website } : {}),
    subscriptionStatus:
      user?.subscriptionStatus ||
      (decoded?.subscriptionStatus as AuthUser['subscriptionStatus']) ||
      undefined,
  };
}

interface AuthState {
  _hasHydrated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;   // Unix ms
  pendingPlan: string | null; // plan slug selected during registration

  // Actions
  setHasHydrated: (state: boolean) => void;
  setSession: (user: AuthUser, accessToken: string, refreshToken: string, expiresIn: number) => void;
  clearSession: () => void;
  setPendingPlan: (planSlug: string | null) => void;
  setSubscriptionStatus: (status: 'ACTIVE' | 'PENDING' | 'NONE') => void;
  isAuthenticated: () => boolean;
  hasRole: (role: string) => boolean;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      user:         null,
      accessToken:  null,
      refreshToken: null,
      expiresAt:    null,
      pendingPlan:  null,

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      setSession: (user, accessToken, refreshToken, expiresIn) => {
        const safeExpiresIn =
          typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0
            ? expiresIn
            : 900;
        const normalizedUser = normalizeSessionUser(user, accessToken);
        set({
          user: normalizedUser,
          accessToken,
          refreshToken,
          expiresAt: Date.now() + safeExpiresIn * 1000,
        });
      },

      clearSession: () => {
        set({ user: null, accessToken: null, refreshToken: null, expiresAt: null, pendingPlan: null });
      },

      setPendingPlan: (planSlug) => {
        set({ pendingPlan: planSlug });
      },

      setSubscriptionStatus: (status) => {
        const current = get().user ?? normalizeSessionUser(null, get().accessToken);
        if (current) {
          set({ user: { ...current, subscriptionStatus: status } });
        }
      },

      isAuthenticated: () => {
        const { accessToken, expiresAt } = get();
        return !!accessToken && !!expiresAt && Date.now() < expiresAt;
      },

      hasRole: (role: string) => {
        const { user, accessToken } = get();
        if (user?.roles?.includes(role)) return true;
        const fallback = normalizeSessionUser(user, accessToken);
        return fallback?.roles?.includes(role) ?? false;
      },

      isTokenExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return true;
        // Consider expired 60s before actual expiry for safe refresh
        return Date.now() > expiresAt - 60_000;
      },
    }),
    {
      name:    'bazionweb-auth',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return {
          getItem: (name: string): string | null => {
            try {
              const fromSession = window.sessionStorage.getItem(name);
              const fromLocal = window.localStorage.getItem(name);
              const raw = fromSession ?? fromLocal;
              if (!raw) return null;
              // Guard against expired tokens lingering in localStorage across tabs
              const parsed = JSON.parse(raw);
              const expiresAt = parsed?.state?.expiresAt;
              if (typeof expiresAt === 'number' && Date.now() >= expiresAt) {
                window.sessionStorage.removeItem(name);
                window.localStorage.removeItem(name);
                return null;
              }
              if (parsed?.state?.accessToken && (!parsed?.state?.user || !Array.isArray(parsed?.state?.user?.roles))) {
                parsed.state.user = normalizeSessionUser(parsed.state.user, parsed.state.accessToken);
                const repaired = JSON.stringify(parsed);
                window.sessionStorage.setItem(name, repaired);
                window.localStorage.setItem(name, repaired);
                return repaired;
              }
              if (!fromSession && fromLocal) {
                window.sessionStorage.setItem(name, fromLocal);
              }
              return raw;
            } catch {
              return null;
            }
          },
          setItem: (name: string, value: string): void => {
            try {
              window.sessionStorage.setItem(name, value);
              window.localStorage.setItem(name, value);
            } catch {
              // Ignore quota errors
            }
          },
          removeItem: (name: string): void => {
            try {
              window.sessionStorage.removeItem(name);
              window.localStorage.removeItem(name);
            } catch {
              // Ignore storage removal errors
            }
          },
        };
      }),
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt:    state.expiresAt,
        pendingPlan:  state.pendingPlan,
      }),
    },
  ),
);

if (typeof window !== 'undefined') {
  if (useAuthStore.persist?.hasHydrated()) {
    useAuthStore.setState({ _hasHydrated: true });
  }
  useAuthStore.persist?.onFinishHydration(() => {
    useAuthStore.setState({ _hasHydrated: true });
  });
  // Synchronize auth state across browser tabs (e.g. magic-link verification or logout in another tab)
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== 'bazionweb-auth') return;
    if (!event.newValue) {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        pendingPlan: null,
      });
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue);
      if (parsed?.state) {
        useAuthStore.setState({
          user: parsed.state.user ?? null,
          accessToken: parsed.state.accessToken ?? null,
          refreshToken: parsed.state.refreshToken ?? null,
          expiresAt: parsed.state.expiresAt ?? null,
          pendingPlan: parsed.state.pendingPlan ?? null,
        });
      }
    } catch {
      // Ignore malformed cross-tab storage payloads
    }
  });
}

