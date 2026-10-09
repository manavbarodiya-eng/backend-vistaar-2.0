import { ApiProperty } from '@nestjs/swagger';

export class CartLineView {
  @ApiProperty({ example: 'K-350' })
  sku!: string;

  @ApiProperty({ example: 'BK-629', description: 'The product (`bulk_sku`).' })
  product_id!: string;

  @ApiProperty()
  product_name!: string;

  @ApiProperty({ type: String, nullable: true })
  product_image!: string | null;

  @ApiProperty({
    example: '1 L',
    description: 'Pack label, as the app shows it.',
  })
  size_label!: string;

  @ApiProperty({ description: 'Live dealer price per pack.' })
  price!: number;

  @ApiProperty({ description: 'Live MRP from the catalogue; 0 when delisted.' })
  mrp!: number;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ description: 'price × quantity.' })
  line_total!: number;

  @ApiProperty()
  available_qty!: number;

  @ApiProperty({ description: 'Sold and in stock for this quantity.' })
  available!: boolean;

  @ApiProperty({ description: 'The price moved since the line was added.' })
  price_changed!: boolean;
}

export class CartView {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'PII-1620388',
    description: "Who the cart is for; `null` = the partner's own stock.",
  })
  pii_id!: string | null;

  @ApiProperty({ type: [CartLineView] })
  items!: CartLineView[];

  @ApiProperty({ description: 'Σ quantity (the cart badge).' })
  item_count!: number;

  @ApiProperty({ description: 'Σ line_total at live prices.' })
  subtotal!: number;

  @ApiProperty({ description: 'A line is unavailable or short of stock.' })
  has_issues!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updated_at!: Date | null;
}
