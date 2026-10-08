import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opt a route out of the globally-applied auth guard.
 *
 * Auth is on by default and switched off per-route, never the reverse — a
 * backend that mounts its auth middleware by hand publishes an endpoint the
 * day someone forgets the argument.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
