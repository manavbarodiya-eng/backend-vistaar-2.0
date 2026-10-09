import { Module } from '@nestjs/common';

import { B2bCatalogClient } from './providers/b2b-catalog.client';
import { CatalogService } from './services/catalog.service';

/** The B2B marketplace catalogue. No routes yet — the app lists products from B2B directly. */
@Module({
  providers: [B2bCatalogClient, CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
