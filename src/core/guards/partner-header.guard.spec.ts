import type { ExecutionContext } from '@nestjs/common';

import { PartnerHeaderGuard } from './partner-header.guard';

function run(request: Record<string, unknown>) {
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return new PartnerHeaderGuard().canActivate(context);
}

describe('PartnerHeaderGuard', () => {
  it('sets the partner from the header', () => {
    const request = { headers: { 'x-partner-id': 'VA-1' } };

    expect(run(request)).toBe(true);
    expect(request).toMatchObject({ user: { partner_id: 'VA-1' } });
  });

  it('lets a request without the header through with no partner', () => {
    const request: Record<string, unknown> = { headers: {} };

    expect(run(request)).toBe(true);
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

    run(verified);
    run(malformed);

    expect(verified.user.partner_id).toBe('VA-real');
    expect(malformed.user).toBeUndefined();
  });
});
