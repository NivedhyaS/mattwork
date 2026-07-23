/**
 * ConcurrencyLimiter utility for throttling asynchronous operations to a maximum concurrency limit.
 */
export class ConcurrencyLimiter {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly maxConcurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

/** Global Google Drive API concurrency limiter — maximum 3 simultaneous Drive folder operations */
export const googleDriveLimiter = new ConcurrencyLimiter(3);
