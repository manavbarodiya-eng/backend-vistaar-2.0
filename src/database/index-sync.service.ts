import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import type { Env } from '@config/env.schema';

/** Only the collections this service created outright. */
const V2_COLLECTION_PREFIX = 'vistaar_v2_';

/**
 * How long one collection's build may take before boot moves on without it.
 *
 * A healthy build on these collections is milliseconds. Anything past this is
 * not slow, it is stuck.
 */
const INDEX_BUILD_TIMEOUT_MS = 15_000;

/**
 * Builds the indexes the v2 schemas declare, and **says so when it cannot**.
 *
 * Mongoose's own `autoIndex` does this at model compile time, but in the
 * background and swallowing the outcome: the first index that fails ends the
 * run and nothing is logged. On a shared database that is how a collection
 * ends up live with only `_id_`, and every duplicate guard it was designed
 * around silently missing (prasar-backend hit exactly this).
 *
 * Three deliberate limits:
 *
 * - **`createIndexes()`, never `syncIndexes()`.** `syncIndexes()` drops
 *   indexes a schema does not declare, and `CRM-Database` is shared with
 *   ko-sales, Stockship and every other portal.
 * - **`vistaar_v2_*` only.** Shared collections (`piis`, `leads_v2`,
 *   `addresses`, …) are not ours to reindex at boot.
 * - **Every build is time-boxed.** This hook runs before `app.listen()`, so a
 *   build that never returns is a server that never binds its port. When the
 *   beta Mongo host ran out of disk, `createIndexes()` stopped answering rather
 *   than failing.
 *
 * Outside production only. There an index build belongs in a migration, run
 * against live data deliberately (listed in `docs/PROD-CHECKLIST.md`).
 */
@Injectable()
export class IndexSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexSyncService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') return;

    // Concurrently: the timeout is per collection, so run serially a wedged
    // host charges boot the *sum* of them. Seven collections at fifteen
    // seconds is nearly two minutes of unbound port on every restart.
    await Promise.all(
      this.connection.modelNames().map(async (name) => {
        const model = this.connection.model(name);
        const collection = model.collection.name;

        if (!collection.startsWith(V2_COLLECTION_PREFIX)) return;

        try {
          // `maxTimeMS` asks the server to give up; the race enforces it when
          // the server is too wedged to notice its own deadline.
          await this.withTimeout(
            model.createIndexes({ maxTimeMS: INDEX_BUILD_TIMEOUT_MS }),
            collection,
          );
        } catch (error) {
          // Loud on purpose. A unique index that will not build is nearly
          // always duplicate rows already in the collection — which is exactly
          // the condition the index was meant to stop, so it has to be read by
          // a human rather than retried forever.
          this.logger.error(
            `Index build failed for ${collection}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );
  }

  /**
   * Rejects once the deadline passes, leaving the original build to finish or
   * fail on its own — detached, but never unhandled, since an unhandled
   * rejection arriving minutes later would take the process down long after
   * boot had recovered from it.
   */
  private async withTimeout<T>(
    build: Promise<T>,
    collection: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `no answer in ${INDEX_BUILD_TIMEOUT_MS}ms — the Mongo host is ` +
                `likely out of disk; ${collection} still has only the indexes ` +
                `it already had`,
            ),
          ),
        INDEX_BUILD_TIMEOUT_MS,
      );
      // Boot must not be held open by this timer alone.
      timer.unref();
    });

    build.catch(() => undefined);

    try {
      return await Promise.race([build, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }
}
