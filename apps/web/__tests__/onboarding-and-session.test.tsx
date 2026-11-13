import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientOnboardingChecklist, {
  sanitizeOnboardingSteps,
} from '@/components/portal/ClientOnboardingChecklist';
import { useAuthStore } from '@/store/auth.store';
import { portalApi } from '../src/lib/api';

jest.mock('../src/lib/api', () => ({
  portalApi: {
    markOnboarded: jest.fn().mockResolvedValue({
      success: true,
      onboardedAt: '2026-11-05T06:00:00.000Z',
    }),
  },
}));

describe('Stage 5: Client Onboarding Checklist & Multi-Tab Session Persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuthStore.getState().clearSession();
    jest.clearAllMocks();
  });

  it('sanitizes onboarding step arrays to valid keys only', () => {
    expect(sanitizeOnboardingSteps(['profile', 'invalid_step', 'vault', 'profile'])).toEqual([
      'profile',
      'vault',
    ]);
    expect(sanitizeOnboardingSteps(null)).toEqual([]);
  });

  it('renders the 4-step checklist when client is not yet onboarded and completes onboarding', async () => {
    const queryClient = new QueryClient();
    const onCompleted = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ClientOnboardingChecklist
          client={{
            id: 'client-1',
            businessName: 'Acme Kenya Ltd',
            contactName: 'Jane Doe',
            phone: '+254712345678',
            onboardedAt: null,
          }}
          hasAssets={true}
          hasProjects={false}
          onCompleted={onCompleted}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Complete Your Client Onboarding/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete Organization Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Connect Domain & DNS/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Deposit Registrar Credentials in Encrypted Vault/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Review Kickoff Roadmap & Milestones/i)).toBeInTheDocument();

    const completeBtn = screen.getByRole('button', { name: /Complete Onboarding/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(portalApi.markOnboarded).toHaveBeenCalled();
      expect(onCompleted).toHaveBeenCalledWith('2026-11-05T06:00:00.000Z');
    });
  });

  it('hides the checklist when client.onboardedAt is already set', () => {
    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ClientOnboardingChecklist
          client={{
            id: 'client-2',
            businessName: 'Onboarded Co',
            onboardedAt: '2026-11-01T00:00:00.000Z',
          }}
        />
      </QueryClientProvider>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('persists active tab session in sessionStorage while stripping raw JWTs from localStorage', () => {
    useAuthStore.getState().setSession(
      {
        id: 'u-1',
        email: 'client@acme.co.ke',
        firstName: 'Jane',
        lastName: 'Doe',
        roles: ['CLIENT'],
        keycloakId: 'u-1',
        subscriptionStatus: 'ACTIVE',
      },
      'access-token-123',
      'refresh-token-456',
      3600,
    );

    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(window.sessionStorage.getItem('bazionweb-auth')).toContain('client@acme.co.ke');
    expect(window.sessionStorage.getItem('bazionweb-auth')).toContain('access-token-123');
    const localSnapshot = window.localStorage.getItem('bazionweb-auth') ?? '';
    expect(localSnapshot).toContain('client@acme.co.ke');
    expect(localSnapshot).not.toContain('access-token-123');
    expect(localSnapshot).not.toContain('refresh-token-456');

    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('recovers user identity and CLIENT role from JWT payload when user object is omitted on setSession', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-jwt-99',
        email: 'bazion001@gmail.com',
        given_name: 'Abazion',
        family_name: 'Client',
        realm_access: { roles: ['CLIENT'] },
        subscriptionStatus: 'ACTIVE',
      }),
    ).toString('base64url');
    const fakeJwt = `${header}.${payload}.sig`;

    // Simulate a caller passing undefined user (e.g. legacy envelope unwrapping)
    useAuthStore.getState().setSession(undefined as any, fakeJwt, 'rt-99', 900);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated()).toBe(true);
    expect(state.hasRole('CLIENT')).toBe(true);
    expect(state.user).toEqual(
      expect.objectContaining({
        id: 'user-jwt-99',
        email: 'bazion001@gmail.com',
        firstName: 'Abazion',
        lastName: 'Client',
        roles: ['CLIENT'],
        subscriptionStatus: 'ACTIVE',
      }),
    );
  });
});
