import { KeyedSerialQueue } from './keyed-serial-queue';

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('KeyedSerialQueue', () => {
  it("runs one key's tasks in order, never overlapping", async () => {
    const queue = new KeyedSerialQueue();
    const log: string[] = [];
    let running = 0;

    const task = (name: string) => async () => {
      running++;
      expect(running).toBe(1);
      log.push(`start ${name}`);
      await tick();
      log.push(`end ${name}`);
      running--;
      return name;
    };

    const results = await Promise.all([
      queue.run('a', task('1')),
      queue.run('a', task('2')),
      queue.run('a', task('3')),
    ]);

    expect(results).toEqual(['1', '2', '3']);
    expect(log).toEqual([
      'start 1',
      'end 1',
      'start 2',
      'end 2',
      'start 3',
      'end 3',
    ]);
  });

  it('runs different keys side by side', async () => {
    const queue = new KeyedSerialQueue();
    let release: () => void = () => undefined;
    const blocked = queue.run(
      'a',
      () => new Promise<void>((r) => (release = r)),
    );

    await expect(queue.run('b', () => Promise.resolve('b'))).resolves.toBe('b');

    release();
    await blocked;
  });

  it('keeps going after a failed task and forgets drained keys', async () => {
    const queue = new KeyedSerialQueue();

    const failed = queue.run('a', () => Promise.reject(new Error('boom')));
    const next = queue.run('a', () => Promise.resolve('ok'));

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
    await tick();

    expect(queue.size).toBe(0);
  });
});
