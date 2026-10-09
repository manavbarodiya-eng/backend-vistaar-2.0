import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CatalogModule } from '@modules/catalog/catalog.module';

import { CartController } from './controllers/cart.controller';
import { CartRepository } from './repositories/cart.repository';
import { Cart, CartSchema } from './schemas/cart.schema';
import { CartService } from './services/cart.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]),
    CatalogModule,
  ],
  controllers: [CartController],
  providers: [CartRepository, CartService],
})
export class CartModule {}
