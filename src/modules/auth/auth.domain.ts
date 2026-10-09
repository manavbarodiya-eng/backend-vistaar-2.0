/**
 * Login and Join Vistaar are two doors (PRD A1/A2): **login** is for a
 * partner who already exists — a number that has completed an OTP verify;
 * **signup** creates one. A number that only asked for an OTP and never
 * verified is not an account yet.
 */
export const OTP_INTENTS = ['login', 'signup'] as const;
export type OtpIntent = (typeof OTP_INTENTS)[number];

export type AccountCheck = 'ok' | 'not_found' | 'exists';

/** Before an SMS goes out: login needs an account, signup must not have one. */
export function checkBeforeSend(
  intent: OtpIntent,
  agent: { otp_verified: boolean } | null,
): AccountCheck {
  const exists = !!agent?.otp_verified;
  if (intent === 'login') return exists ? 'ok' : 'not_found';
  return exists ? 'exists' : 'ok';
}

/**
 * At verify: login still needs an account. Signup passes even when the
 * number is already verified — that is the same partner re-submitting the
 * code (a double tap), and send already refused a real duplicate.
 */
export function checkBeforeVerify(
  intent: OtpIntent,
  agent: { otp_verified: boolean },
): AccountCheck {
  return intent === 'login' && !agent.otp_verified ? 'not_found' : 'ok';
}
