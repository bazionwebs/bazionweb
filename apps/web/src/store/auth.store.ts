import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  keycloakId: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;   // Unix ms

  // Actions
  setSession: (user: AuthUser, accessToken: string, refreshToken: string, expiresIn: number) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
  hasRole: (role: string) => boolean;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      expiresAt:    null,

      setSession: (user, accessToken, refreshToken, expiresIn) => {
        set({
          user,
          accessToken,
          refreshToken,
          expiresAt: Date.now() + expiresIn * 1000,
        });
      },

      clearSession: () => {
        set({ user: null, accessToken: null, refreshToken: null, expiresAt: null });
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
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt:    state.expiresAt,
      }),
    },
  ),
);
