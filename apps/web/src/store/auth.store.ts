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
        set({
          user,
          accessToken,
          refreshToken,
          expiresAt: Date.now() + expiresIn * 1000,
        });
      },

      clearSession: () => {
        set({ user: null, accessToken: null, refreshToken: null, expiresAt: null, pendingPlan: null });
      },

      setPendingPlan: (planSlug) => {
        set({ pendingPlan: planSlug });
      },

      setSubscriptionStatus: (status) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, subscriptionStatus: status } });
        }
      },

      isAuthenticated: () => {
        const { accessToken, expiresAt } = get();
        return !!accessToken && !!expiresAt && Date.now() < expiresAt;
      },

      hasRole: (role: string) => {
        const { user } = get();
        return user?.roles?.includes(role) ?? false;
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

