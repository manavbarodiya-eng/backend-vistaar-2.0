import { z } from 'zod';

/**
 * Every environment variable this service reads, declared in one place.
 *
 * The only file that touches `process.env`. An unknown variable is dead weight
 * you can see, and a missing required one fails the boot with its own name.
 * Adding a variable means adding it here, to `.env.example`, and a case to
 * `env.schema.spec.ts` if it has a default or a coercion.
 *
 * Auth (OTP, app tokens, SSO for the HO portal) and the ko-sales lead intake
 * add their variables with the login module.
 */

/** `"true"`/`"false"` strings only — z.coerce.boolean() treats "false" as true. */
const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),

  /** `CRM-Database`, shared with ko-sales and every other portal. */
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().min(1).default('CRM-Database'),

  /** Comma-separated. Empty = no browser origin allowed (the mobile app still
   *  works — native clients send no Origin header). `*` = any. */
  CORS_ORIGINS: z.string().default(''),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  /** Swagger UI at `/docs` is off unless explicitly switched on. */
  SWAGGER_ENABLED: booleanFromString,
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\n`);
  }

  return parsed.data;
}

/** Parsed comma-separated CORS origins, empties stripped. */
export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * `CORS_ORIGINS` as the CORS layer wants it.
 *
 *  - `*`      → `true`, which **reflects** the caller's own Origin. Not the
 *               literal `*` header: that is illegal next to
 *               `credentials: true`, so a browser would reject every
 *               authenticated call while the preflight looked fine.
 *  - a list   → those exact origins.
 *  - empty    → `false`, no browser origin at all.
 */
export function resolveCorsOrigin(raw: string): true | string[] | false {
  const origins = parseCorsOrigins(raw);

  if (origins.includes('*')) return true;

  return origins.length > 0 ? origins : false;
}
