import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthUser } from '@common/auth/current-partner.decorator';
import type { Env } from '@config/env.schema';

export const PARTNER_HEADER = 'x-partner-id';

const PARTNER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * **Temporary, until the login module.** With `TRUST_PARTNER_HEADER=true`,
 * takes the caller's partner id from the `x-partner-id` header — so the app
 * can use the cart before tokens exist. Anyone can claim any id this way,
 * which is why it is off by default.
 *
 * Not a gate: it never rejects. It only fills `request.user` when nothing
 * else did; `@CurrentPartner()` still answers 401 when there is no partner.
 * When the auth guard lands, switch the flag off and delete this file — no
 * route changes.
 */
@Injectable()
export class PartnerHeaderGuard implements CanActivate {
  private readonly enabled: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.enabled = config.get('TRUST_PARTNER_HEADER', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) return true;

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
