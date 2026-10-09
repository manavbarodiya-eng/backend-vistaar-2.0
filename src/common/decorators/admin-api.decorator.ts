import { SetMetadata } from '@nestjs/common';

export const IS_ADMIN_KEY = 'isAdminApi';

/**
 * Marks a controller (or route) as HO-portal only: the global guard then
 * expects a company SSO token instead of a partner token. Pair it with
 * `@Can('<capability>')` on each route.
 */
export const AdminApi = () => SetMetadata(IS_ADMIN_KEY, true);
