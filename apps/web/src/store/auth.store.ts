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
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? sessionStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hasHydrated: true });
      },
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
