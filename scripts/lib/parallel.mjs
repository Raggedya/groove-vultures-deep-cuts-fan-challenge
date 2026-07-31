export async function mapLimit(items, limit, worker, { onProgress } = {}) {
  const source = [...items];
  const results = new Array(source.length);
  const jobs = Math.max(1, Math.min(Number(limit) || 1, source.length || 1));
  let cursor = 0;
  let completed = 0;
  let failure = null;

  await Promise.allSettled(Array.from({ length: jobs }, async () => {
    while (!failure && cursor < source.length) {
      const index = cursor++;
      try {
        results[index] = await worker(source[index], index);
        completed += 1;
        onProgress?.({ completed, total: source.length, item: source[index], index });
      } catch (error) {
        failure ||= error;
      }
    }
  }));

  if (failure) throw failure;
  return results;
}
