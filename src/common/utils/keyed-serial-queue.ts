/**
 * Runs tasks that share a key one after another, and tasks with different keys
 * side by side.
 *
 * For read-modify-write on one document: requests for the same key stop
 * racing each other inside this process, so a compare-and-set only has to
 * settle races *between* instances. Memory is one entry per key with work in
 * flight, dropped when its queue drains.
 */
export class KeyedSerialQueue {
  private readonly tails = new Map<string, Promise<void>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task);

    // The next task waits for this one to settle, not to succeed.
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);

    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });

    return result;
  }

  /** Keys with work queued or running. */
  get size(): number {
    return this.tails.size;
  }
}
