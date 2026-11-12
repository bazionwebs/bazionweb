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
