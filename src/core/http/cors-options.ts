import type { NestFastifyApplication } from '@nestjs/platform-fastify';

type CorsOptions = NonNullable<
  Parameters<NestFastifyApplication['enableCors']>[0]
>;

/**
 * Every verb a controller here answers, named so a browser's preflight is told.
 *
 * Left unset, `@fastify/cors` 11 answers a preflight with `GET,HEAD,POST` —
 * so every `@Patch` and `@Delete` route would be blocked in the HO portal's
 * browser before the request was ever sent, whatever the token said. The app
 * never sees it: a native client sends no preflight.
 *
 * A route with a new verb needs it added here, or it fails the same way.
 */
export const CORS_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

/** The one CORS rule — `main.ts` and the specs build the app from it. */
export function corsOptions(origin: true | string[] | false): CorsOptions {
  return { origin, credentials: true, methods: [...CORS_METHODS] };
}
