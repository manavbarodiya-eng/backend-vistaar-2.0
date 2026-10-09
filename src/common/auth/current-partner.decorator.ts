import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';

/**
 * What the auth guard leaves on `request.user` once a partner's token checks
 * out. The guard arrives with the login module; until then nothing sets it and
 * every route reading `@CurrentPartner()` answers 401, which is the safe
 * failure — never a cart read with someone else's id.
 */
export interface AuthUser {
  partner_id: string;
}

/**
 * The calling partner's id, taken from the verified token — never from the
 * body, the query or a path param, so a partner cannot name another partner.
 */
export const CurrentPartner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: Partial<AuthUser> }>();
    const partnerId = request.user?.partner_id;

    if (typeof partnerId !== 'string' || partnerId.length === 0) {
      throw new UnauthorizedException('Sign in again to continue.');
    }

    return partnerId;
  },
);
