import { verdictOf } from './otp.service';

describe('verdictOf', () => {
  it.each([
    [true, { otp_verified: true }, 'verified'],
    [true, { data: { otp_verified: true } }, 'verified'],
    [true, { message: 'OTP verified successfully' }, 'verified'],
    [true, { message: 'OTP verified success', type: 'success' }, 'status_only'],
    [false, { message: 'OTP verified successfully' }, 'refused'],
    [true, null, 'status_only'],
    [true, { otp_verified: false }, 'refused'],
    [true, { otp_verified: 'true' }, 'refused'],
    [true, { data: { otp_verified: false } }, 'refused'],
    [true, { error: 'OTP verification failed' }, 'refused'],
    [true, { type: 'error', message: 'OTP not match' }, 'refused'],
    [true, { data: { type: 'error', message: 'OTP expired' } }, 'refused'],
    [
      false,
      {
        error: 'OTP verification failed',
        data: { message: 'Mobile no. already verified', type: 'error' },
      },
      'refused',
    ],
    [false, { otp_verified: true }, 'refused'],
    [false, null, 'refused'],
  ])('ok=%s %j → %s', (ok, body, expected) => {
    expect(verdictOf(ok, body)).toBe(expected);
  });
});
