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

  @ApiProperty()
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
  @ApiProperty({ type: String, nullable: true })
  customer_id!: string | null;

  @ApiProperty({ type: String, nullable: true })
  customer_name!: string | null;

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

export class SavedCartLineView {
  @ApiProperty()
  sku!: string;

  @ApiProperty()
  product_id!: string;

  @ApiProperty()
  product_name!: string;

  @ApiProperty({ type: String, nullable: true })
  product_image!: string | null;

  @ApiProperty()
  size_label!: string;

  @ApiProperty()
  quantity!: number;
}

export class SavedCartView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  customer_id!: string | null;

  @ApiProperty({ type: String, nullable: true })
  customer_name!: string | null;

  @ApiProperty({ type: [SavedCartLineView] })
  items!: SavedCartLineView[];

  @ApiProperty()
  item_count!: number;

  @ApiProperty({ description: 'Value when saved.' })
  subtotal!: number;

  @ApiProperty()
  reminder_sent!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  updated_at!: Date;
}
