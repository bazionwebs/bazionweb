import { useAuthStore, isSandboxTab, isSandboxActive } from '../src/store/auth.store';

describe('Milestone 1 Remediation: Client View-As Sandbox Tab Isolation', () => {
  const adminCredentials = JSON.stringify({
    state: {
      user: {
        id: 'admin-super-1',
        email: 'admin@bazion.com',
        firstName: 'System',
        lastName: 'Administrator',
        roles: ['ADMIN', 'SUPER_ADMIN'],
        keycloakId: 'admin-super-1',
        subscriptionStatus: 'ACTIVE',
      },
      accessToken: 'admin-super-access-token',
      refreshToken: 'admin-super-refresh-token',
      expiresAt: Date.now() + 3600 * 1000,
      pendingPlan: null,
      isSandbox: false,
      sandboxMeta: null,
    },
    version: 0,
  });

  const clientSandboxCredentials = JSON.stringify({
    state: {
      user: {
        id: 'client-user-42',
        email: 'client@acme.co.ke',
        firstName: 'Jane',
        lastName: 'Doe',
        roles: ['CLIENT'],
        keycloakId: 'client-user-42',
        subscriptionStatus: 'ACTIVE',
        impersonatedBy: 'admin@bazion.com',
        isSandbox: true,
      },
      accessToken: 'sandbox-jwt-impersonation-token',
      refreshToken: null,
      expiresAt: Date.now() + 15 * 60 * 1000,
      pendingPlan: null,
      isSandbox: true,
      sandboxMeta: {
        clientId: 'client-org-42',
        clientBusinessName: 'Acme Kenya Limited',
        impersonatedBy: 'admin@bazion.com',
      },
    },
    version: 0,
  });

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('correctly identifies sandbox tabs using isSandboxTab()', () => {
    expect(isSandboxTab()).toBe(false);
    expect(isSandboxActive()).toBe(false);

    window.sessionStorage.setItem('bazionweb_sandbox_active', 'true');
    expect(isSandboxTab()).toBe(true);
    expect(isSandboxActive()).toBe(true);

    window.sessionStorage.removeItem('bazionweb_sandbox_active');
    window.sessionStorage.setItem('bazionweb_is_sandbox_tab', 'true');
    expect(isSandboxTab()).toBe(true);
    expect(isSandboxActive()).toBe(false);
  });

  it('Finding 1: clearSession() in sandbox tab NEVER overwrites or wipes admin credentials in localStorage', () => {
    // 1. Simulate admin session already stored in localStorage (from originating admin tab)
    window.localStorage.setItem('bazionweb-auth', adminCredentials);

    // 2. Simulate current tab being an active client sandbox session
    window.sessionStorage.setItem('bazionweb_is_sandbox_tab', 'true');
    window.sessionStorage.setItem('bazionweb_sandbox_active', 'true');
    window.sessionStorage.setItem('bazionweb_sandbox_token', 'sandbox-jwt-impersonation-token');
    window.sessionStorage.setItem('bazionweb-auth', clientSandboxCredentials);

    // Verify initial conditions
    expect(window.localStorage.getItem('bazionweb-auth')).toBe(adminCredentials);
    expect(window.sessionStorage.getItem('bazionweb-auth')).toBe(clientSandboxCredentials);
    expect(isSandboxTab()).toBe(true);

    // 3. Trigger clearSession() (as executed when exiting sandbox or signing out of sandbox)
    useAuthStore.getState().clearSession();

    // 4. Verification:
    // Administrator credentials in localStorage MUST remain 100% intact and unaffected
    const adminInLocal = window.localStorage.getItem('bazionweb-auth');
    expect(adminInLocal).toBe(adminCredentials);
    expect(adminInLocal).not.toBeNull();
    const parsedAdmin = JSON.parse(adminInLocal!);
    expect(parsedAdmin.state.user.id).toBe('admin-super-1');
    expect(parsedAdmin.state.accessToken).toBe('admin-super-access-token');

    // Sandbox session keys in sessionStorage are cleaned up, but permanent tab marker is preserved
    expect(window.sessionStorage.getItem('bazionweb_sandbox_active')).toBeNull();
    expect(window.sessionStorage.getItem('bazionweb_sandbox_token')).toBeNull();
    expect(window.sessionStorage.getItem('bazionweb_is_sandbox_tab')).toBe('true');
  });

  it('Finding 2: Expired sandbox token in getItem returns null and NEVER falls back to admin localStorage', () => {
    // 1. Admin session stored in localStorage
    window.localStorage.setItem('bazionweb-auth', adminCredentials);

    // 2. Sandbox session stored in sessionStorage with expired token (expired 5 minutes ago)
    const expiredSandboxCredentials = JSON.stringify({
      state: {
        user: {
          id: 'client-user-42',
          email: 'client@acme.co.ke',
          roles: ['CLIENT'],
          isSandbox: true,
        },
        accessToken: 'expired-sandbox-token',
        expiresAt: Date.now() - 5 * 60 * 1000,
        isSandbox: true,
      },
      version: 0,
    });

    window.sessionStorage.setItem('bazionweb_is_sandbox_tab', 'true');
    window.sessionStorage.setItem('bazionweb_sandbox_active', 'true');
    window.sessionStorage.setItem('bazionweb_sandbox_token', 'expired-sandbox-token');
    window.sessionStorage.setItem('bazionweb-auth', expiredSandboxCredentials);

    const storage = useAuthStore.persist.getOptions().storage;
    expect(storage).toBeDefined();

    // 3. First call to getItem: detects token is expired
    const firstResult = storage!.getItem('bazionweb-auth') as string | null;
    expect(firstResult).toBeNull();

    // bazionweb_sandbox_active is removed, but bazionweb_is_sandbox_tab MUST persist
    expect(window.sessionStorage.getItem('bazionweb_sandbox_active')).toBeNull();
    expect(window.sessionStorage.getItem('bazionweb_is_sandbox_tab')).toBe('true');

    // 4. Second call to getItem (simulates subsequent re-render, component remount, or tab refresh)
    // In the unpatched code, this fell through to window.localStorage and loaded admin credentials.
    const secondResult = storage!.getItem('bazionweb-auth') as string | null;
    expect(secondResult).toBeNull();

    // Verify admin credentials were NOT copied into sessionStorage
    expect(window.sessionStorage.getItem('bazionweb-auth')).toBeNull();

    // Verify localStorage admin session was untouched
    expect(window.localStorage.getItem('bazionweb-auth')).toBe(adminCredentials);
  });

  it('setItem and removeItem in sandbox tab NEVER write or remove from localStorage', () => {
    window.localStorage.setItem('bazionweb-auth', adminCredentials);
    window.sessionStorage.setItem('bazionweb_is_sandbox_tab', 'true');

    const storage = useAuthStore.persist.getOptions().storage;
    expect(storage).toBeDefined();

    // Test setItem
    const testObject = { state: { user: null } };
    storage!.setItem('bazionweb-auth', testObject as any);

    expect(window.sessionStorage.getItem('bazionweb-auth')).toBe(JSON.stringify(testObject));
    // localStorage MUST NOT have been overwritten with testPayload
    expect(window.localStorage.getItem('bazionweb-auth')).toBe(adminCredentials);

    // Test removeItem
    storage!.removeItem('bazionweb-auth');
    expect(window.sessionStorage.getItem('bazionweb-auth')).toBeNull();
    // localStorage MUST NOT have been removed
    expect(window.localStorage.getItem('bazionweb-auth')).toBe(adminCredentials);
  });

  it('ignores external cross-tab storage events when inside a sandbox tab', () => {
    window.sessionStorage.setItem('bazionweb_is_sandbox_tab', 'true');
    window.sessionStorage.setItem('bazionweb_sandbox_active', 'true');

    useAuthStore.setState({
      user: {
        id: 'client-user-42',
        email: 'client@acme.co.ke',
        firstName: 'Jane',
        lastName: 'Doe',
        roles: ['CLIENT'],
        keycloakId: 'client-user-42',
        isSandbox: true,
      },
      accessToken: 'sandbox-jwt-impersonation-token',
      refreshToken: null,
      expiresAt: Date.now() + 15 * 60 * 1000,
      pendingPlan: null,
      isSandbox: true,
      sandboxMeta: {
        clientId: 'client-org-42',
        clientBusinessName: 'Acme Kenya Limited',
        impersonatedBy: 'admin@bazion.com',
      },
    });

    expect(useAuthStore.getState().user?.email).toBe('client@acme.co.ke');

    // Simulate cross-tab storage event: admin logs out in originating admin tab
    const storageEvent = new StorageEvent('storage', {
      key: 'bazionweb-auth',
      newValue: null,
      oldValue: adminCredentials,
    });
    window.dispatchEvent(storageEvent);

    // In a sandbox tab, the external logout event MUST be ignored
    expect(useAuthStore.getState().user?.email).toBe('client@acme.co.ke');
    expect(useAuthStore.getState().accessToken).toBe('sandbox-jwt-impersonation-token');
  });

  it('ignores URL ?sandbox_token query parameters and hydrates sandbox state only via verified server session', () => {
    // Generate valid 15-minute token
    const expSeconds = Math.floor(Date.now() / 1000) + 15 * 60;
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'client-u-77',
        email: 'client77@acme.co.ke',
        given_name: 'David',
        family_name: 'Ochieng',
        clientId: 'client-77',
        clientBusinessName: 'Ochieng Logistics Ltd',
        realm_access: { roles: ['CLIENT'] },
        subscriptionStatus: 'ACTIVE',
        impersonatedBy: 'auditor@bazion.com',
        isSandbox: true,
        exp: expSeconds,
      }),
    ).toString('base64url');
    const sandboxToken = `${header}.${payload}.mockSignature`;

    delete (window as any).location;
    window.location = {
      search: `?sandbox_token=${sandboxToken}`,
      pathname: '/portal',
      hash: '',
    } as any;

    // Admin session in localStorage (already stripped of tokens by persist storage)
    window.localStorage.setItem('bazionweb-auth', adminCredentials);

    const storage = useAuthStore.persist.getOptions().storage;
    storage!.getItem('bazionweb-auth');

    // URL query param token MUST NEVER be ingested into sessionStorage or state
    expect(window.sessionStorage.getItem('bazionweb_sandbox_token')).toBeNull();
    expect(window.sessionStorage.getItem('bazionweb_sandbox_active')).toBeNull();

    // Server-verified HttpOnly cookie hydration populates tab-isolated sandbox state without exposing a token
    useAuthStore.getState().setSandboxSession(
      {
        id: 'client-u-77',
        email: 'client77@acme.co.ke',
        firstName: 'David',
        lastName: 'Ochieng',
        roles: ['CLIENT'],
        keycloakId: 'client-u-77',
        subscriptionStatus: 'ACTIVE',
        impersonatedBy: 'auditor@bazion.com',
        isSandbox: true,
      },
      expSeconds * 1000,
      {
        clientId: 'client-77',
        clientBusinessName: 'Ochieng Logistics Ltd',
        impersonatedBy: 'auditor@bazion.com',
      },
    );

    const hydrated = useAuthStore.getState();
    expect(hydrated.user?.id).toBe('client-u-77');
    expect(hydrated.user?.email).toBe('client77@acme.co.ke');
    expect(hydrated.isSandbox).toBe(true);
    expect(hydrated.accessToken).toBeNull();
    expect(hydrated.isAuthenticated()).toBe(true);
    expect(window.sessionStorage.getItem('bazionweb_is_sandbox_tab')).toBe('true');
    expect(window.sessionStorage.getItem('bazionweb_sandbox_active')).toBe('true');

    // Admin localStorage remains unaffected
    expect(window.localStorage.getItem('bazionweb-auth')).toBe(adminCredentials);
  });

  it('handleExitSandbox workflow cleanly terminates sandbox session and leaves admin localStorage intact', () => {
    // 1. Admin credentials in localStorage
    window.localStorage.setItem('bazionweb-auth', adminCredentials);

    // 2. Active client sandbox in sessionStorage
    window.sessionStorage.setItem('bazionweb_is_sandbox_tab', 'true');
    window.sessionStorage.setItem('bazionweb_sandbox_active', 'true');
    window.sessionStorage.setItem('bazionweb_sandbox_token', 'sandbox-token-xyz');
    window.sessionStorage.setItem('bazionweb-auth', clientSandboxCredentials);

    const closeSpy = jest.spyOn(window, 'close').mockImplementation(() => {});

    // 3. Execute handleExitSandbox sequence:
    // clearSession() -> remove active sandbox keys -> close tab
    useAuthStore.getState().clearSession();
    window.sessionStorage.removeItem('bazionweb_sandbox_active');
    window.sessionStorage.removeItem('bazionweb_sandbox_token');
    window.sessionStorage.removeItem('bazionweb-auth');
    window.close();

    // 4. Assertions:
    expect(closeSpy).toHaveBeenCalled();

    // Admin localStorage is completely untouched
    const adminInLocal = window.localStorage.getItem('bazionweb-auth');
    expect(adminInLocal).toBe(adminCredentials);

    // Session keys are removed
    expect(window.sessionStorage.getItem('bazionweb_sandbox_active')).toBeNull();
    expect(window.sessionStorage.getItem('bazionweb_sandbox_token')).toBeNull();
    expect(window.sessionStorage.getItem('bazionweb-auth')).toBeNull();

    // Permanent tab marker is preserved
    expect(window.sessionStorage.getItem('bazionweb_is_sandbox_tab')).toBe('true');
    expect(isSandboxTab()).toBe(true);

    closeSpy.mockRestore();
  });
});
