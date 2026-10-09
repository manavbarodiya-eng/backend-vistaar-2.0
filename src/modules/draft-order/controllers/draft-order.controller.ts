import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { B2bToken } from '@common/auth/b2b-token.decorator';
import {
  CurrentPartner,
  CurrentPartnerId,
  type PartnerRef,
} from '@common/auth/current-partner.decorator';
import { PageResult } from '@common/http/page-result';
import { CartView } from '@modules/cart/dto/cart-view.dto';

import {
  DraftOrderParamDto,
  DraftOrdersQueryDto,
} from '../dto/draft-order-request.dto';
import { DraftOrderView } from '../dto/draft-order-view.dto';
import { DraftOrderService } from '../services/draft-order.service';

/**
 * The partner's draft orders — carts saved for a customer, in the shared
 * `draft_orders` collection. Nothing in a path or body says whose they are.
 * Routes that read the cart or price lines also need the agent's B2B token.
 */
@ApiTags('draft-orders')
@ApiBearerAuth()
@ApiSecurity('b2b-token')
@ApiExtraModels(PageResult, DraftOrderView)
@Controller('draft-orders')
export class DraftOrderController {
  constructor(private readonly drafts: DraftOrderService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Save the active cart as a draft (one per customer; saving again replaces it)',
  })
  @ApiOkResponse({ type: DraftOrderView })
  save(
    @CurrentPartner() partner: PartnerRef,
    @B2bToken() token: string,
  ): Promise<DraftOrderView> {
    return this.drafts.save(partner, token);
  }

  @Get()
  @ApiOperation({ summary: 'Open drafts, newest first' })
  list(
    @CurrentPartnerId() partnerId: string,
    @Query() query: DraftOrdersQueryDto,
  ): Promise<PageResult<DraftOrderView>> {
    return this.drafts.list(partnerId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One open draft' })
  @ApiOkResponse({ type: DraftOrderView })
  get(
    @CurrentPartnerId() partnerId: string,
    @Param() { id }: DraftOrderParamDto,
  ): Promise<DraftOrderView> {
    return this.drafts.get(partnerId, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Replace the active cart with a draft (re-priced, capped at stock)',
  })
  @ApiOkResponse({ type: CartView })
  restore(
    @CurrentPartner() partner: PartnerRef,
    @B2bToken() token: string,
    @Param() { id }: DraftOrderParamDto,
  ): Promise<CartView> {
    return this.drafts.restore(partner, token, id);
  }

  @Post(':id/reminder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record that a WhatsApp reminder was sent' })
  @ApiOkResponse({ type: DraftOrderView })
  markReminderSent(
    @CurrentPartnerId() partnerId: string,
    @Param() { id }: DraftOrderParamDto,
  ): Promise<DraftOrderView> {
    return this.drafts.markReminderSent(partnerId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an open draft' })
  delete(
    @CurrentPartnerId() partnerId: string,
    @Param() { id }: DraftOrderParamDto,
  ): Promise<{ deleted: true }> {
    return this.drafts.delete(partnerId, id);
  }
}
