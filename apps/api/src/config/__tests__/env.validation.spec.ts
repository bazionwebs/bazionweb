import { envValidationSchema } from '../env.validation';

const validBaseConfig = {
  DATABASE_URL: 'postgresql://localhost:5432/bazionweb',
  JWT_SECRET: 'unit-test-secret-with-at-least-32-characters',
};

describe('document signing key validation', () => {
  it('allows document signing to use the validated JWT secret fallback', () => {
    const { error } = envValidationSchema.validate(validBaseConfig);

    expect(error).toBeUndefined();
  });

  it('accepts dedicated current and previous keys with at least 32 characters', () => {
    const { error } = envValidationSchema.validate({
      ...validBaseConfig,
      DOCUMENT_SIGNING_SECRET: 'current-document-signing-secret-32-chars',
      DOCUMENT_SIGNING_PREVIOUS_SECRET: 'previous-document-signing-secret-32-chars',
    });

    expect(error).toBeUndefined();
  });

  it('rejects a weak configured document signing key', () => {
    const { error } = envValidationSchema.validate({
      ...validBaseConfig,
      DOCUMENT_SIGNING_SECRET: 'weak',
    });

    expect(error?.details.some(({ path }) => path[0] === 'DOCUMENT_SIGNING_SECRET')).toBe(true);
  });

  it('rejects a weak key during signing key rotation', () => {
    const { error } = envValidationSchema.validate({
      ...validBaseConfig,
      DOCUMENT_SIGNING_PREVIOUS_SECRET: 'weak',
    });

    expect(error?.details.some(({ path }) => path[0] === 'DOCUMENT_SIGNING_PREVIOUS_SECRET')).toBe(true);
  });
});

describe('customer & OIDC auth policy validation', () => {
  it('accepts AUTH_PROVIDER=oidc in non-production environments', () => {
    const { error, value } = envValidationSchema.validate({
      ...validBaseConfig,
      AUTH_PROVIDER: 'oidc',
    });

    expect(error).toBeUndefined();
    expect(value.AUTH_PROVIDER).toBe('oidc');
  });

  it('defaults CUSTOMER_LOCAL_AUTH_DISABLED to true in production when AUTH_PROVIDER=local has no override', () => {
    const { error, value } = envValidationSchema.validate({
      ...validBaseConfig,
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'local',
    });

    expect(error).toBeUndefined();
    expect(value.CUSTOMER_LOCAL_AUTH_DISABLED).toBe('true');
  });

  it('fails closed in production when CUSTOMER_LOCAL_AUTH_DISABLED=false lacks ALLOW_LEGACY_CUSTOMER_LOCAL_AUTH=true', () => {
    const { error } = envValidationSchema.validate({
      ...validBaseConfig,
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'local',
      CUSTOMER_LOCAL_AUTH_DISABLED: 'false',
    });

    expect(error?.message).toContain('CUSTOMER_AUTH_POLICY_REQUIRED');
  });

  it('rejects conflicting ALLOW_LEGACY_CUSTOMER_LOCAL_AUTH=true with AUTH_PROVIDER=oidc in production', () => {
    const { error } = envValidationSchema.validate({
      ...validBaseConfig,
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'oidc',
      ALLOW_LEGACY_CUSTOMER_LOCAL_AUTH: 'true',
      OIDC_ISSUER: 'https://platform.bazionweb.com',
      OIDC_BFF_SESSION_SECRET: 'oidc-session-secret-minimum-32-characters',
    });

    expect(error?.message).toContain('CUSTOMER_LOCAL_AUTH_CONFLICT');
  });

  it('accepts production AUTH_PROVIDER=oidc with HTTPS OIDC_ISSUER and >=32-char OIDC_BFF_SESSION_SECRET', () => {
    const { error } = envValidationSchema.validate({
      ...validBaseConfig,
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'oidc',
      STAFF_LOCAL_AUTH_POLICY: 'allow_staff_only',
      OIDC_ISSUER: 'https://platform.bazionweb.com',
      OIDC_BFF_SESSION_SECRET: 'oidc-session-secret-minimum-32-characters',
    });

    expect(error).toBeUndefined();
  });
});
