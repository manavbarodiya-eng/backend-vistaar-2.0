import { can, capabilitiesOf, roleOf } from './access.domain';

describe('roleOf', () => {
  it.each([
    ['USR-1037', true, 'head'],
    ['USR-1000', true, 'head'],
    ['USR-1001', true, 'head'],
    ['USR-1001', false, null],
    ['USR-1012', true, null],
    [null, true, null],
  ])('%s active=%s → %s', (code, active, expected) => {
    expect(roleOf(code, active)).toBe(expected);
  });
});

describe('capabilities', () => {
  it('head can do everything in the table', () => {
    expect(can('head', 'agents.decide')).toBe(true);
    expect(capabilitiesOf('head')).toContain('config.publish');
  });
});
