/**
 * Seeds the five PRD cohorts and a first published form for each, into
 * `vistaar_v2_cohorts` and `vistaar_v2_onboarding_configs` only.
 *
 *   node dist/scripts/seed-onboarding.js           # dry run — writes nothing
 *   node dist/scripts/seed-onboarding.js --apply   # creates what is missing
 *   … --apply --republish   # also re-publishes seed-made forms from the defaults
 *
 * A cohort or form HO has touched is left exactly as HO made it: `--republish`
 * only replaces a form this seed published, and never while a draft is open. Runs through the same services the HO portal uses, so a seeded
 * form passes the same checks as one published by hand.
 */
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { CohortsService } from '../modules/onboarding/services/cohorts.service';
import { ConfigsService } from '../modules/onboarding/services/configs.service';
import { configErrors } from '../modules/onboarding/form.domain';
import { DEFAULT_COHORTS, defaultSteps } from './default-forms';

const BY = 'seed:default-forms';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const republish = process.argv.includes('--republish');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const log = (line: string) => console.log(`[seed-onboarding] ${line}`);
  const cohorts = app.get(CohortsService);
  const configs = app.get(ConfigsService);

  try {
    const existing = new Set((await cohorts.list(false)).map((c) => c._id));
    for (const cohort of DEFAULT_COHORTS) {
      const steps = defaultSteps(cohort);
      const errors = configErrors(steps);
      if (errors.length) throw new Error(`${cohort.key}: ${errors.join('; ')}`);

      const published = await configs.published(cohort.key);
      const draft = await configs.draft(cohort.key);
      const hasForm = !!published || !!draft;
      const stale = republish && !draft && published?.published_by === BY;
      const formPlan = stale
        ? `re-publish as v${(published?.version ?? 0) + 1}`
        : hasForm
          ? 'form exists'
          : 'create + publish form v1';
      const plan = `${existing.has(cohort.key) ? 'cohort exists' : 'create cohort'}, ${formPlan}`;
      log(`${cohort.key}: ${plan}`);
      if (!apply) continue;

      if (!existing.has(cohort.key)) {
        await cohorts.create(
          {
            key: cohort.key,
            label: cohort.label,
            description: cohort.description,
            icon: cohort.icon,
            order: cohort.order,
            sub_types: cohort.sub_types,
            is_active: true,
          },
          BY,
        );
      }
      if (!hasForm || stale) {
        await configs.saveDraft(
          cohort.key,
          steps,
          stale
            ? 'Defaults updated: 12-digit Aadhaar, KYC copied to org documents'
            : 'Initial form from the Vistaar 2.0 PRD',
          BY,
        );
        await configs.publish(cohort.key, BY);
      }
    }
    log(apply ? 'Applied.' : 'Dry run — nothing written. Re-run with --apply.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
