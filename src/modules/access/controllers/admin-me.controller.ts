import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '@common/decorators/current-principal.decorator';
import type { AdminPrincipal } from '@common/interfaces/principal.interface';

import { Can } from '../guards/capability.guard';
import { AccessService, type AdminAccess } from '../services/access.service';

@ApiTags('admin · access')
@Controller('admin/me')
export class AdminMeController {
  constructor(private readonly access: AccessService) {}

  @Get()
  @Can()
  @ApiOperation({
    summary:
      'The HO caller’s Vistaar role and capabilities — gate screens and buttons on `capabilities`',
  })
  me(@CurrentAdmin() admin: AdminPrincipal): Promise<AdminAccess> {
    return this.access.accessFor(admin);
  }
}
