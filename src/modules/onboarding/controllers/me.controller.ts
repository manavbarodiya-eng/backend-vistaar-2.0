import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPartner } from '@common/decorators/current-principal.decorator';
import type { PartnerPrincipal } from '@common/interfaces/principal.interface';

import { MeService, type MeView } from '../services/me.service';

@ApiTags('app · me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @ApiOperation({
    summary:
      'Who I am and where my application stands — drives the pending / status screen and what the app unlocks',
  })
  get(@CurrentPartner() partner: PartnerPrincipal): Promise<MeView> {
    return this.me.get(partner.sub);
  }
}
