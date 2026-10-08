/**
 * An Indian mobile number as `piis.phone_number` stores it — the bare ten
 * digits — or `null` when the input does not hold one.
 *
 * People type the dialled form (`+91 91550 61725`, `09155061725`,
 * `919155061725`). Matching the raw string finds no PII and mints a second
 * person for the same number, so every read and write normalises through here.
 */
export function normalizeMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const national = digits.length > 10 ? digits.slice(-10) : digits;

  // A longer input must only have lost a country code or a trunk zero, never
  // real digits — `1234567890123` is not a mobile number with a prefix.
  if (digits.length > 10 && !/^(0|91|091)$/.test(digits.slice(0, -10))) {
    return null;
  }

  return /^[6-9]\d{9}$/.test(national) ? national : null;
}

/** What `normalizeMobile` accepts, for DTO messages and Swagger. */
export const MOBILE_EXAMPLE = '9155061725';
