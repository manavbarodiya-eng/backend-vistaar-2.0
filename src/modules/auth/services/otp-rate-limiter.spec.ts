import { SlidingWindowLimiter } from './otp-rate-limiter';

describe('SlidingWindowLimiter', () => {
  it('allows the limit, then asks the caller to wait', () => {
    const limiter = new SlidingWindowLimiter(3, 60_000);
    expect(limiter.take('9', 0)).toBe(0);
    expect(limiter.take('9', 1_000)).toBe(0);
    expect(limiter.take('9', 2_000)).toBe(0);
    expect(limiter.take('9', 3_000)).toBe(57);
    expect(limiter.take('8', 3_000)).toBe(0);
  });

  it('frees a slot once the oldest hit leaves the window', () => {
    const limiter = new SlidingWindowLimiter(1, 60_000);
    expect(limiter.take('9', 0)).toBe(0);
    expect(limiter.take('9', 60_000)).toBe(0);
  });
});
