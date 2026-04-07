// lib/concurrency.ts — Shared concurrency limiter used by all pipeline agents

export function createConcurrencyLimiter(max: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (queue.length > 0 && running < max) {
      running++;
      queue.shift()!();
    }
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      if (running < max) { running++; resolve(); }
      else { queue.push(resolve); }
    });
    try { return await fn(); }
    finally { running--; next(); }
  };
}
