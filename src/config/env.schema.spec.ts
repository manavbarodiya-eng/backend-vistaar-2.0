import { resolveCorsOrigin, validateEnv } from './env.schema';

const BASE = {
  MONGODB_URI: 'mongodb://localhost:27017',
  VISTAAR_JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('fails the boot naming the missing variable', () => {
    expect(() => validateEnv({})).toThrow(/MONGODB_URI/);
    expect(() => validateEnv({})).toThrow(/VISTAAR_JWT_SECRET/);
  });

  it('applies the defaults', () => {
    const env = validateEnv(BASE);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      MONGODB_DB_NAME: 'CRM-Database',
      CORS_ORIGINS: '',
      SWAGGER_ENABLED: false,
      ACCESS_TOKEN_TTL_SECONDS: 43200,
      REFRESH_TOKEN_TTL_DAYS: 30,
      OTP_API_URL: 'https://utils.ko-tech.in',
    });
  });

  it('refuses OTP test numbers in production', () => {
    expect(() =>
      validateEnv({
        ...BASE,
        NODE_ENV: 'production',
        OTP_TEST_NUMBERS: '9999999901',
      }),
    ).toThrow(/OTP_TEST_NUMBERS/);
    expect(() =>
      validateEnv({
        ...BASE,
        NODE_ENV: 'development',
        OTP_TEST_NUMBERS: '9999999901',
      }),
    ).not.toThrow();
  });

  it('reads "false" as false', () => {
    const env = validateEnv({ ...BASE, SWAGGER_ENABLED: 'false' });

    expect(env.SWAGGER_ENABLED).toBe(false);
  });
});

describe('resolveCorsOrigin', () => {
  it.each([
    ['', false],
    ['*', true],
    [
      'https://a.ko-tech.in, https://b.ko-tech.in',
      ['https://a.ko-tech.in', 'https://b.ko-tech.in'],
    ],
  ])('%j → %j', (raw, expected) => {
    expect(resolveCorsOrigin(raw)).toEqual(expected);
  });
});
