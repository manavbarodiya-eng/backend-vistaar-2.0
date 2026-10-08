import { normalizeMobile } from './phone.util';

describe('normalizeMobile', () => {
  it.each([
    ['9155061725', '9155061725'],
    ['+91 91550 61725', '9155061725'],
    ['919155061725', '9155061725'],
    ['09155061725', '9155061725'],
    ['091-9155061725', '9155061725'],
  ])('reads %s as %s', (input, expected) => {
    expect(normalizeMobile(input)).toBe(expected);
  });

  // Each of these would otherwise reach `piis` as a person nobody can call.
  it.each([
    ['too short', '915506172'],
    ['a landline-style first digit', '2155061725'],
    ['extra digits that are not a prefix', '1239155061725'],
    ['empty', ''],
  ])('refuses %s', (_label, input) => {
    expect(normalizeMobile(input)).toBeNull();
  });
});
