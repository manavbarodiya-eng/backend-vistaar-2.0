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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { B2bToken } from '@common/auth/b2b-token.decorator';
import { CurrentPartnerId } from '@common/auth/current-partner.decorator';

import {
  AddCartItemDto,
  SetCartCustomerDto,
  SkuParamDto,
  UpdateCartItemDto,
} from '../dto/cart-request.dto';
import { CartView } from '../dto/cart-view.dto';
import { CartService } from '../services/cart.service';

/**
 * The partner's own cart. Nothing in a path or body says whose cart it is.
 * Routes that price lines also need the agent's B2B token
 * (`Authorization: Bearer …`), which is passed on to the B2B catalogue.
 */
@ApiTags('cart')
@ApiBearerAuth()
@ApiSecurity('b2b-token')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'The active cart, priced live' })
  @ApiOkResponse({ type: CartView })
  get(
    @CurrentPartnerId() partnerId: string,
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
    @CurrentPartnerId() partnerId: string,
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
    @CurrentPartnerId() partnerId: string,
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
    @CurrentPartnerId() partnerId: string,
    @B2bToken() token: string,
    @Param() { sku }: SkuParamDto,
  ): Promise<CartView> {
    return this.cart.removeItem(partnerId, token, sku);
  }

  @Put('customer')
  @ApiOperation({
    summary: "Who the cart is for: a customer's pii_id, or null for own stock",
  })
  @ApiOkResponse({ type: CartView })
  setCustomer(
    @CurrentPartnerId() partnerId: string,
    @B2bToken() token: string,
    @Body() dto: SetCartCustomerDto,
  ): Promise<CartView> {
    return this.cart.setCustomer(partnerId, token, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Empty the cart and clear its customer' })
  @ApiOkResponse({ type: CartView })
  clear(
    @CurrentPartnerId() partnerId: string,
    @B2bToken() token: string,
  ): Promise<CartView> {
    return this.cart.clear(partnerId, token);
  }
}
