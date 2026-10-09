import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';

/**
 * The signed-in agent's B2B Sales access token, from `Authorization: Bearer …`.
 *
 * The app signs agents in against B2B Sales and renews the token itself, so
 * there is no long-lived token this server could keep in its env. The token
 * is only passed on to B2B (the catalogue that prices the cart) — this server
 * does not verify it, and never logs it (`req.headers.authorization` is
 * redacted).
 */
export const B2bToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;

    if (!match) {
      throw new UnauthorizedException('Sign in again to continue.');
    }

    return match[1];
  },
);
