import { ApiProperty } from '@nestjs/swagger';

import type { PageQueryDto } from '../dto/page-query.dto';

/**
 * The `/api/v2` list payload.
 *
 * Deliberately **not** a `Paginated<T>`: the envelope interceptor lifts that
 * one's `meta` up beside `data`, whereas v2 keeps the page counters inside
 * `data` where the app's `useInfiniteQuery` reads them:
 *
 *   { "success": true,
 *     "data": { "items": [...], "page": 1, "limit": 50, "total": 213, "has_more": true } }
 *
 * `has_more` rather than `totalPages` because the client only ever asks one
 * question of it — "is there a next page?" — and computing that from a total
 * is where an off-by-one strands the last page.
 *
 * Field names stay snake_case here, like the rest of v2. The mobile client has
 * one `toDomain()` mapper per feature and camel-cases at that boundary.
 */
export class PageResult<T> {
  @ApiProperty({ isArray: true })
  readonly items: T[];

  @ApiProperty()
  readonly page: number;

  @ApiProperty()
  readonly limit: number;

  @ApiProperty()
  readonly total: number;

  @ApiProperty()
  readonly has_more: boolean;

  constructor(items: T[], total: number, query: PageQueryDto) {
    this.items = items;
    this.page = query.page;
    this.limit = query.limit;
    this.total = total;
    this.has_more = query.page * query.limit < total;
  }
}
