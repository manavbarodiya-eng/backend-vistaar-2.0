import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { StepDef } from '../form.domain';
import {
  OnboardingConfig,
  type OnboardingConfigDocument,
} from '../schemas/onboarding-config.schema';

@Injectable()
export class ConfigRepository {
  constructor(
    @InjectModel(OnboardingConfig.name)
    private readonly model: Model<OnboardingConfigDocument>,
  ) {}

  latestPublished(cohort: string): Promise<OnboardingConfig | null> {
    return this.model
      .findOne({ cohort, status: 'published' })
      .sort({ version: -1 })
      .lean<OnboardingConfig | null>()
      .exec();
  }

  version(cohort: string, version: number): Promise<OnboardingConfig | null> {
    return this.model
      .findById(`${cohort}@${version}`)
      .lean<OnboardingConfig | null>()
      .exec();
  }

  draft(cohort: string): Promise<OnboardingConfig | null> {
    return this.model
      .findOne({ cohort, status: 'draft' })
      .lean<OnboardingConfig | null>()
      .exec();
  }

  /** Version list without the (large) steps. */
  versions(cohort: string): Promise<Omit<OnboardingConfig, 'steps'>[]> {
    return this.model
      .find({ cohort })
      .select('-steps')
      .sort({ version: -1 })
      .lean<Omit<OnboardingConfig, 'steps'>[]>()
      .exec();
  }

  async maxVersion(cohort: string): Promise<number> {
    const top = await this.model
      .findOne({ cohort })
      .sort({ version: -1 })
      .select('version')
      .lean<{ version: number } | null>()
      .exec();
    return top?.version ?? 0;
  }

  async createDraft(row: {
    cohort: string;
    version: number;
    steps: StepDef[];
    notes: string | null;
    by: string;
  }): Promise<OnboardingConfig> {
    const doc = await this.model.create({
      _id: `${row.cohort}@${row.version}`,
      cohort: row.cohort,
      version: row.version,
      status: 'draft',
      steps: row.steps,
      notes: row.notes,
      created_by: row.by,
      updated_by: row.by,
    });
    return doc.toObject<OnboardingConfig>();
  }

  updateDraft(
    cohort: string,
    steps: StepDef[],
    notes: string | null,
    by: string,
  ): Promise<OnboardingConfig | null> {
    return this.model
      .findOneAndUpdate(
        { cohort, status: 'draft' },
        { $set: { steps, notes, updated_by: by } },
        { returnDocument: 'after' },
      )
      .lean<OnboardingConfig | null>()
      .exec();
  }

  /** Draft → published, conditional on it still being the draft. */
  publish(id: string, by: string): Promise<OnboardingConfig | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, status: 'draft' },
        {
          $set: {
            status: 'published',
            published_at: new Date(),
            published_by: by,
            updated_by: by,
          },
        },
        { returnDocument: 'after' },
      )
      .lean<OnboardingConfig | null>()
      .exec();
  }

  async archiveOlder(
    cohort: string,
    version: number,
    by: string,
  ): Promise<void> {
    await this.model
      .updateMany(
        { cohort, status: 'published', version: { $lt: version } },
        { $set: { status: 'archived', updated_by: by } },
      )
      .exec();
  }

  async deleteDraft(cohort: string): Promise<boolean> {
    return (
      (await this.model.deleteOne({ cohort, status: 'draft' }).exec())
        .deletedCount === 1
    );
  }

  async existsForCohort(cohort: string): Promise<boolean> {
    return (await this.model.exists({ cohort })) !== null;
  }
}
