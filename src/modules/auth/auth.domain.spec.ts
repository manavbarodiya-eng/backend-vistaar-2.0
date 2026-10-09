import { checkBeforeSend, checkBeforeVerify } from './auth.domain';

const verified = { otp_verified: true };
const pending = { otp_verified: false };

describe('checkBeforeSend', () => {
  it.each([
    ['login', null, 'not_found'],
    ['login', pending, 'not_found'],
    ['login', verified, 'ok'],
    ['signup', null, 'ok'],
    ['signup', pending, 'ok'],
    ['signup', verified, 'exists'],
  ] as const)('%s with %j → %s', (intent, agent, expected) => {
    expect(checkBeforeSend(intent, agent)).toBe(expected);
  });
});

describe('checkBeforeVerify', () => {
  it.each([
    ['login', pending, 'not_found'],
    ['login', verified, 'ok'],
    ['signup', pending, 'ok'],
    ['signup', verified, 'ok'],
  ] as const)('%s with %j → %s', (intent, agent, expected) => {
    expect(checkBeforeVerify(intent, agent)).toBe(expected);
  });
});
