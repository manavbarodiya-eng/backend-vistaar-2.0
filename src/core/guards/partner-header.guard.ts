import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

import type { AuthUser } from '@common/auth/current-partner.decorator';

export const PARTNER_HEADER = 'x-partner-id';

const PARTNER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * **Temporary, until the login module.** Takes the caller's partner id from
 * the `x-partner-id` header. The B2B token cannot stand in: the app signs in
 * to B2B with one shared account, so every partner's token names the same
 * user. Anyone can claim any id this way — it must go when login lands.
 *
 * Not a gate: it never rejects. It only fills `request.user` when nothing
 * else did; `@CurrentPartner()` still answers 401 when there is no partner.
 * When the auth guard lands, delete this file — no route changes.
 */
@Injectable()
export class PartnerHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = request.headers[PARTNER_HEADER];

    if (
      !request.user &&
      typeof header === 'string' &&
      PARTNER_ID_PATTERN.test(header)
    ) {
      request.user = { partner_id: header };
    }

    return true;
  }
}
