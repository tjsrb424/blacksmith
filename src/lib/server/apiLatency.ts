import "server-only";

type ApiRunner<T> = () => Promise<T> | T;

function shouldLog() {
  return process.env.NODE_ENV !== "production";
}

export async function withApiLatency<T>(
  name: string,
  run: ApiRunner<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await run();
  } finally {
    if (shouldLog()) {
      const elapsedMs = Date.now() - startedAt;
      const message =
        elapsedMs >= 1000
          ? `[${name}] slow request ${elapsedMs}ms`
          : `[${name}] completed in ${elapsedMs}ms`;
      if (elapsedMs >= 1000) {
        console.warn(message);
      } else {
        console.log(message);
      }
    }
  }
}
