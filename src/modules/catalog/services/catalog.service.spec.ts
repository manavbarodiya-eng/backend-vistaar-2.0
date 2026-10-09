import type { ConfigService } from '@nestjs/config';

import type { Env } from '@config/env.schema';

import type { CatalogVariant } from '../catalog.domain';
import {
  B2bUnauthorizedError,
  type B2bCatalogClient,
} from '../providers/b2b-catalog.client';
import { CatalogService } from './catalog.service';

const TTL_SECONDS = 60;
const TOKEN = 'agent-token';

function variant(sku: string, price = 100): CatalogVariant {
  return {
    sku,
    product_id: 'BK-1',
    product_name: 'P',
    product_image: null,
    size_label: '1 L',
    price,
    mrp: 200,
    gst: 0,
    available_qty: 5,
  };
}

describe('CatalogService', () => {
  let fetchAll: jest.Mock<Promise<CatalogVariant[]>, [string]>;
  let service: CatalogService;
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    fetchAll = jest.fn<Promise<CatalogVariant[]>, [string]>();
    const config = {
      get: () => TTL_SECONDS,
    } as unknown as ConfigService<Env, true>;
    service = new CatalogService(
      { fetchAll } as unknown as B2bCatalogClient,
      config,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('shares one fetch between concurrent cold callers', async () => {
    fetchAll.mockResolvedValue([variant('K-1')]);

    const results = await Promise.all([
      service.variant('K-1', TOKEN),
      service.variant('K-1', TOKEN),
      service.variants(['K-1', 'K-x'], TOKEN),
    ]);

    expect(fetchAll).toHaveBeenCalledTimes(1);
    expect(fetchAll).toHaveBeenCalledWith(TOKEN);
    expect(results[0]?.sku).toBe('K-1');
    expect([...results[2].keys()]).toEqual(['K-1']);
  });

  it('answers from memory while fresh', async () => {
    fetchAll.mockResolvedValue([variant('K-1')]);
    await service.variant('K-1', TOKEN);

    now += TTL_SECONDS * 1000 - 1;
    await service.variant('K-1', TOKEN);

    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('serves stale at once and refreshes in the background', async () => {
    fetchAll.mockResolvedValueOnce([variant('K-1', 100)]);
    await service.variant('K-1', TOKEN);

    now += TTL_SECONDS * 1000 + 1;
    let release: (v: CatalogVariant[]) => void = () => undefined;
    fetchAll.mockReturnValueOnce(
      new Promise<CatalogVariant[]>((resolve) => (release = resolve)),
    );

    expect((await service.variant('K-1', TOKEN))?.price).toBe(100);
    expect(fetchAll).toHaveBeenCalledTimes(2);

    release([variant('K-1', 150)]);
    await new Promise((r) => setImmediate(r));

    expect((await service.variant('K-1', TOKEN))?.price).toBe(150);
  });

  it('keeps serving stale while the B2B API is down', async () => {
    fetchAll.mockResolvedValueOnce([variant('K-1')]);
    await service.variant('K-1', TOKEN);

    now += 5 * 60_000;
    fetchAll.mockRejectedValue(new Error('down'));

    await expect(service.variant('K-1', TOKEN)).resolves.toMatchObject({
      sku: 'K-1',
    });
  });

  it('answers CATALOG_UNAVAILABLE with nothing usable in memory', async () => {
    fetchAll.mockRejectedValue(new Error('down'));

    await expect(service.variant('K-1', TOKEN)).rejects.toMatchObject({
      status: 503,
      response: { error: 'CATALOG_UNAVAILABLE' },
    });

    fetchAll.mockResolvedValueOnce([variant('K-1')]);
    await service.variant('K-1', TOKEN);
    now += 60 * 60_000;
    fetchAll.mockRejectedValue(new Error('down'));

    await expect(service.variant('K-1', TOKEN)).rejects.toMatchObject({
      status: 503,
    });
  });

  it('answers 401 when B2B refuses the agent token, so the app renews it', async () => {
    fetchAll.mockRejectedValue(new B2bUnauthorizedError('expired'));

    await expect(service.variant('K-1', TOKEN)).rejects.toMatchObject({
      status: 401,
    });
  });
});
