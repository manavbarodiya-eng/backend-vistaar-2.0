import { resolveCorsOrigin, validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('fails the boot naming the missing variable', () => {
    expect(() => validateEnv({})).toThrow(/MONGODB_URI/);
  });

  it('applies the defaults', () => {
    const env = validateEnv({ MONGODB_URI: 'mongodb://localhost:27017' });

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      MONGODB_DB_NAME: 'CRM-Database',
      CORS_ORIGINS: '',
      SWAGGER_ENABLED: false,
    });
  });

  it('reads "false" as false', () => {
    const env = validateEnv({
      MONGODB_URI: 'mongodb://localhost:27017',
      SWAGGER_ENABLED: 'false',
    });

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
