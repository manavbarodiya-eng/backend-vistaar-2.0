import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { Env } from '@config/env.schema';

import { PartnerHeaderGuard } from './partner-header.guard';

function run(enabled: boolean, request: Record<string, unknown>) {
  const guard = new PartnerHeaderGuard({
    get: () => enabled,
  } as unknown as ConfigService<Env, true>);
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return guard.canActivate(context);
}

describe('PartnerHeaderGuard', () => {
  it('sets the partner from the header when switched on', () => {
    const request = { headers: { 'x-partner-id': 'VA-1' } };

    expect(run(true, request)).toBe(true);
    expect(request).toMatchObject({ user: { partner_id: 'VA-1' } });
  });

  it('ignores the header when switched off', () => {
    const request: Record<string, unknown> = {
      headers: { 'x-partner-id': 'VA-1' },
    };

    expect(run(false, request)).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('never overrides a verified user, and ignores a malformed id', () => {
    const verified = {
      user: { partner_id: 'VA-real' },
      headers: { 'x-partner-id': 'VA-other' },
    };
    const malformed: Record<string, unknown> = {
      headers: { 'x-partner-id': '{"$ne":1}' },
    };

    run(true, verified);
    run(true, malformed);

    expect(verified.user.partner_id).toBe('VA-real');
    expect(malformed.user).toBeUndefined();
  });
});
