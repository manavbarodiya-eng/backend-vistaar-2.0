import { resolveCorsOrigin, validateEnv } from './env.schema';

const REQUIRED = {
  MONGODB_URI: 'mongodb://localhost:27017',
  B2B_API_URL: 'https://api.b2bsales.example/api/v1',
};

describe('validateEnv', () => {
  it('fails the boot naming the missing variable', () => {
    expect(() => validateEnv({})).toThrow(/MONGODB_URI/);
  });

  it('applies the defaults', () => {
    const env = validateEnv(REQUIRED);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      MONGODB_DB_NAME: 'CRM-Database',
      CORS_ORIGINS: '',
      SWAGGER_ENABLED: false,
      B2B_MARKETPLACE_CODE: 'MKTP-1',
      CATALOG_CACHE_TTL_SECONDS: 60,
    });
  });

  it('fails the boot without the B2B catalogue URL', () => {
    expect(() =>
      validateEnv({ MONGODB_URI: 'mongodb://localhost:27017' }),
    ).toThrow(/B2B_API_URL/);
  });

  it('reads "false" as false', () => {
    const env = validateEnv({ ...REQUIRED, SWAGGER_ENABLED: 'false' });

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
