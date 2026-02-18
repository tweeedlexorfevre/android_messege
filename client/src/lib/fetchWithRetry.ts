const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RetryOptions = {
  attempts?: number;
  delayMs?: number;
};

const isRetryableStatus = (status: number) =>
  status === 500 || status === 502 || status === 503;

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {},
) {
  const attempts = options.attempts ?? 2;
  const delayMs = options.delayMs ?? 1500;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, init);
      if (!isRetryableStatus(response.status) || i === attempts - 1) {
        return response;
      }
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (i === attempts - 1) {
        throw error;
      }
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error("Failed to fetch");
}
