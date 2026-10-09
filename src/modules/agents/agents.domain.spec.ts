import { canMove, PARTNER_EDITABLE } from './agents.domain';

describe('stage moves', () => {
  it.each([
    ['submit', 'onboarding', true],
    ['submit', 'changes_requested', true],
    ['submit', 'kyc_review', false],
    ['approve', 'kyc_review', true],
    ['approve', 'onboarding', false],
    ['approve', 'approved', false],
    ['reject', 'changes_requested', true],
    ['reopen', 'rejected', true],
    ['reopen', 'approved', false],
    ['block', 'blocked', false],
    ['block', 'approved', true],
  ] as const)('%s from %s → %s', (action, stage, expected) => {
    expect(canMove(action, stage)).toBe(expected);
  });

  it('locks the form once submitted', () => {
    expect(PARTNER_EDITABLE.has('kyc_review')).toBe(false);
    expect(PARTNER_EDITABLE.has('changes_requested')).toBe(true);
  });
});
