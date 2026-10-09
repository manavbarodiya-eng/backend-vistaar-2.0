import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import { PageQueryDto } from '@common/dto/page-query.dto';

import { MAX_QUANTITY } from '../cart.domain';

/** B2B skus look like `K-350`; anything else never matches a pack. */
const SKU_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export class AddCartItemDto {
  @ApiProperty({
    example: 'K-350',
    description: 'Pack sku (a variant, not the bulk sku).',
  })
  @Matches(SKU_PATTERN, { message: 'sku is not a valid pack sku.' })
  sku!: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: MAX_QUANTITY,
    default: 1,
    description:
      'Added to the quantity already in the cart, then capped at stock.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity = 1;
}

export class UpdateCartItemDto {
  @ApiProperty({
    type: Number,
    minimum: 0,
    maximum: MAX_QUANTITY,
    description: 'The new quantity, capped at stock. 0 removes the line.',
  })
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  quantity!: number;
}

export class SkuParamDto {
  @ApiProperty({ example: 'K-350' })
  @Matches(SKU_PATTERN, { message: 'sku is not a valid pack sku.' })
  sku!: string;
}

export class SetCartCustomerDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Customer the cart is for; `null` for the partner's own shop stock.",
  })
  @ValidateIf((o: SetCartCustomerDto) => o.customer_id !== null)
  @IsString()
  @Length(1, 64)
  customer_id!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Shown on the saved-carts list.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  customer_name?: string | null;
}

export class SavedCartParamDto {
  @ApiProperty({ example: '6abbb5a498175c65660f0dee' })
  @IsMongoId({ message: 'id is not a saved cart id.' })
  id!: string;
}

/** Saved carts are listed newest first; `sort` is accepted and ignored. */
export class SavedCartsQueryDto extends PageQueryDto {}
