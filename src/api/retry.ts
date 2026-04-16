export interface FetchRetryOptions {
	maxRetries?: number;
	initialDelayMs?: number;
	backoffFactor?: number;
}

const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_BACKOFF_FACTOR = 2;
const JITTER_FRACTION = 0.2;

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));


export const fetchWithRetry = async (
	fn: () => Promise<Response>,
	opts: FetchRetryOptions = {}
): Promise<Response> => {
	const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

	if (!Number.isFinite(maxRetries) || maxRetries < 0) {
		throw new RangeError("maxRetries must be a non-negative finite number");
	}

	const initialDelayMs = opts.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
	const backoffFactor = opts.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;

	const delayFor = (attempt: number): number => {
		const base = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
		return base + base * JITTER_FRACTION * (Math.random() * 2 - 1);
	};

	let attempt = 0;
	while (attempt <= maxRetries) {
		try {
			const response = await fn();

			if (response.status === 429 ) {
				attempt++;
				if (attempt > maxRetries) return response;
				await response.body?.cancel(); // cancel the body to release the socket back to pool
				await sleep(delayFor(attempt));
				continue;
			}

			return response;
		} catch (err) {
			attempt++;
			if (attempt > maxRetries) throw err;
			await sleep(delayFor(attempt));
		}
	}

	throw new Error("Unreachable: retry loop exhausted");
};
