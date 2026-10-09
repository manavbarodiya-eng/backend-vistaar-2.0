import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';

import type { AuthedRequest } from '@common/interfaces/principal.interface';

/**
 * The calling partner's `VST-` id, from the partner token `AppAuthGuard`
 * verified — never from a header, the body, the query or a path param, so a
 * partner cannot name another partner.
 */
export const CurrentPartnerId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (user?.kind !== 'partner' || !user.agent_id) {
      throw new UnauthorizedException('Sign in again to continue.');
    }
    return user.agent_id;
  },
);
