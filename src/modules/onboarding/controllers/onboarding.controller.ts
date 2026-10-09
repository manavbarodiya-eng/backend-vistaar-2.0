import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentPartner } from '@common/decorators/current-principal.decorator';
import { badRequest } from '@common/errors/api-error';
import type { PartnerPrincipal } from '@common/interfaces/principal.interface';
import {
  PincodeService,
  type PincodeInfo,
} from '@modules/spine/services/pincode.service';

import { SaveOnboardingDto } from '../dto/onboarding.dto';
import type { Cohort } from '../schemas/cohort.schema';
import type { OnboardingConfig } from '../schemas/onboarding-config.schema';
import { CohortsService } from '../services/cohorts.service';
import { ConfigsService } from '../services/configs.service';
import {
  OnboardingService,
  type OnboardingView,
} from '../services/onboarding.service';

@ApiTags('app · onboarding')
@ApiBearerAuth()
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly configs: ConfigsService,
    private readonly cohorts: CohortsService,
    private readonly pincodes: PincodeService,
  ) {}

  @Get('cohorts')
  @ApiOperation({
    summary: 'Partner types the app offers (active only), in display order',
  })
  async cohortsList(): Promise<
    Pick<
      Cohort,
      '_id' | 'label' | 'description' | 'icon' | 'sub_types' | 'order'
    >[]
  > {
    const rows = await this.cohorts.list(true);
    return rows.map(({ _id, label, description, icon, sub_types, order }) => ({
      _id,
      label,
      description,
      icon,
      sub_types,
      order,
    }));
  }

  @Get('config')
  @ApiOperation({
    summary:
      'The published form for a partner type — steps, fields, labels in every language. Sends an ETag; revalidate with If-None-Match.',
  })
  @ApiQuery({ name: 'cohort', example: 'vistaar_agent' })
  async config(
    @Query('cohort') cohort?: string,
  ): Promise<Pick<OnboardingConfig, '_id' | 'cohort' | 'version' | 'steps'>> {
    if (!cohort) throw badRequest('COHORT_REQUIRED', 'Pass ?cohort=');
    const { _id, version, steps } = await this.configs.requirePublished(cohort);
    return {
      _id,
      cohort,
      version,
      steps: steps.filter((s) => s.is_active).sort((a, b) => a.order - b.order),
    };
  }

  @Get('pincode/:pincode')
  @ApiOperation({
    summary:
      'State, district and taluk for a pincode — to prefill the location step',
  })
  async pincode(
    @Param('pincode') pincode: string,
  ): Promise<PincodeInfo | null> {
    return this.pincodes.lookup(pincode.trim());
  }

  @Get()
  @ApiOperation({
    summary:
      'My onboarding data (null before the first save), with signed file URLs',
  })
  mine(
    @CurrentPartner() partner: PartnerPrincipal,
  ): Promise<OnboardingView | null> {
    return this.onboarding.mine(partner.sub);
  }

  @Patch()
  @ApiOperation({
    summary:
      'Save any number of fields (call after every step). First call needs `cohort`.',
  })
  save(
    @CurrentPartner() partner: PartnerPrincipal,
    @Body() dto: SaveOnboardingDto,
  ): Promise<OnboardingView> {
    return this.onboarding.save(partner.sub, dto);
  }

  @Post('submit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Submit for KYC review. Locks the form until HO asks for changes.',
  })
  submit(@CurrentPartner() partner: PartnerPrincipal): Promise<OnboardingView> {
    return this.onboarding.submit(partner.sub);
  }
}
