import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
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
import { CurrentPartner } from '@common/auth/current-partner.decorator';
import { PageResult } from '@common/http/page-result';

import {
  AddCartItemDto,
  SavedCartParamDto,
  SavedCartsQueryDto,
  SetCartCustomerDto,
  SkuParamDto,
  UpdateCartItemDto,
} from '../dto/cart-request.dto';
import { CartView, SavedCartView } from '../dto/cart-view.dto';
import { CartService } from '../services/cart.service';

/**
 * The partner's own cart. Nothing in a path or body says whose cart it is.
 * Routes that price lines also need the agent's B2B token
 * (`Authorization: Bearer …`), which is passed on to the B2B catalogue.
 */
@ApiTags('cart')
@ApiBearerAuth()
@ApiSecurity('partner-header')
@ApiExtraModels(PageResult, SavedCartView)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'The active cart, priced live' })
  @ApiOkResponse({ type: CartView })
  get(
    @CurrentPartner() partnerId: string,
    @B2bToken() token: string,
  ): Promise<CartView> {
    return this.cart.get(partnerId, token);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add a pack (added to any already there, capped at stock)',
  })
  @ApiOkResponse({ type: CartView })
  addItem(
    @CurrentPartner() partnerId: string,
    @B2bToken() token: string,
    @Body() dto: AddCartItemDto,
  ): Promise<CartView> {
    return this.cart.addItem(partnerId, token, dto);
  }

  @Patch('items/:sku')
  @ApiOperation({
    summary: "Set a line's quantity (0 removes, capped at stock)",
  })
  @ApiOkResponse({ type: CartView })
  updateItem(
    @CurrentPartner() partnerId: string,
    @B2bToken() token: string,
    @Param() { sku }: SkuParamDto,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartView> {
    return this.cart.updateItem(partnerId, token, sku, dto.quantity);
  }

  @Delete('items/:sku')
  @ApiOperation({ summary: 'Remove a line' })
  @ApiOkResponse({ type: CartView })
  removeItem(
    @CurrentPartner() partnerId: string,
    @B2bToken() token: string,
    @Param() { sku }: SkuParamDto,
  ): Promise<CartView> {
    return this.cart.removeItem(partnerId, token, sku);
  }

  @Put('customer')
  @ApiOperation({ summary: 'Who the cart is for (null = own shop stock)' })
  @ApiOkResponse({ type: CartView })
  setCustomer(
    @CurrentPartner() partnerId: string,
    @B2bToken() token: string,
    @Body() dto: SetCartCustomerDto,
  ): Promise<CartView> {
    return this.cart.setCustomer(partnerId, token, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Empty the cart and clear its customer' })
  @ApiOkResponse({ type: CartView })
  clear(
    @CurrentPartner() partnerId: string,
    @B2bToken() token: string,
  ): Promise<CartView> {
    return this.cart.clear(partnerId, token);
  }

  // ── Saved carts ───────────────────────────────────────────────────────

  @Post('saved')
  @ApiOperation({
    summary: 'Save the active cart for later (one per customer)',
  })
  @ApiOkResponse({ type: SavedCartView })
  save(
    @CurrentPartner() partnerId: string,
    @B2bToken() token: string,
  ): Promise<SavedCartView> {
    return this.cart.save(partnerId, token);
  }

  @Get('saved')
  @ApiOperation({ summary: 'Saved carts, newest first' })
  listSaved(
    @CurrentPartner() partnerId: string,
    @Query() query: SavedCartsQueryDto,
  ): Promise<PageResult<SavedCartView>> {
    return this.cart.listSaved(partnerId, query);
  }

  @Post('saved/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace the active cart with a saved one' })
  @ApiOkResponse({ type: CartView })
  restore(
    @CurrentPartner() partnerId: string,
    @B2bToken() token: string,
    @Param() { id }: SavedCartParamDto,
  ): Promise<CartView> {
    return this.cart.restore(partnerId, token, id);
  }

  @Post('saved/:id/reminder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record that a WhatsApp reminder was sent' })
  @ApiOkResponse({ type: SavedCartView })
  markReminderSent(
    @CurrentPartner() partnerId: string,
    @Param() { id }: SavedCartParamDto,
  ): Promise<SavedCartView> {
    return this.cart.markReminderSent(partnerId, id);
  }

  @Delete('saved/:id')
  @ApiOperation({ summary: 'Delete a saved cart' })
  deleteSaved(
    @CurrentPartner() partnerId: string,
    @Param() { id }: SavedCartParamDto,
  ): Promise<{ deleted: true }> {
    return this.cart.deleteSaved(partnerId, id);
  }
}
