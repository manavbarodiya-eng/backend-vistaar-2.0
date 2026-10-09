import { configErrors } from '../modules/onboarding/form.domain';
import { DEFAULT_COHORTS, defaultSteps } from './default-forms';

describe('default forms', () => {
  it.each(DEFAULT_COHORTS.map((c) => [c.key, c] as const))(
    '%s is publishable',
    (_key, cohort) => {
      expect(configErrors(defaultSteps(cohort))).toEqual([]);
    },
  );
});
