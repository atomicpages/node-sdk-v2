import { FetchHttpError } from "./fetch-errors";
import { fetchWithRetry } from "./retry";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT" | "OPTIONS" | "HEAD";

export interface ApiClientConfig {
	baseURL: string;
	headers?: Record<string, string>;
	timeout?: number;
}

export interface RequestConfig {
	headers?: Record<string, string>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	params?: Record<string, any>;
	timeout?: number;
	/** data is used as the JSON body for DELETE requests. */
	data?: unknown;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const JSON_CONTENT_TYPE = "application/json";

/** @internal */
export const buildUrl = (
	baseURL: string,
	path: string,
	params?: RequestConfig["params"]
): string => {
	const relative = path.startsWith("/") ? path.slice(1) : path;
	if (!params) {
		return baseURL + relative;
	}
	const url = new URL(relative, baseURL);
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) continue;
		url.searchParams.append(key, String(value));
	}
	return url.toString();
};

/** @internal – fetch with an AbortController-based timeout. */
export const fetchWithTimeout = async (
	url: string,
	init: RequestInit,
	timeoutMs: number
): Promise<Response> => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
};

/** @internal */
export const parseBody = async (response: Response): Promise<unknown> => {
	if (response.status === 204) return undefined;
	const text = await response.text();
	if (text.length === 0) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};

export class ApiClient {
	private readonly baseURL: string;
	private readonly defaultHeaders: Record<string, string>;
	private readonly timeout: number;

	constructor(config: ApiClientConfig) {
		this.baseURL = config.baseURL.endsWith("/")
			? config.baseURL
			: `${config.baseURL}/`;
		this.defaultHeaders = { ...(config.headers ?? {}) };
		this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
		console.log("[FetchApiClient] initialized", { baseURL: this.baseURL });
	}

	public setAccessToken(token: string) {
		this.defaultHeaders["Authorization"] = `Bearer ${token}`;
	}

	public get<T>(url: string, config?: RequestConfig): Promise<T> {
		return this.request<T>("GET", url, undefined, config);
	}

	public post<T>(
		url: string,
		data?: unknown,
		config?: RequestConfig
	): Promise<T> {
		const { body, headers } = this.serializeBody(data, config);
		return this.request<T>("POST", url, body, {
			...config,
			headers,
		});
	}

	public patch<T>(
		url: string,
		data?: unknown,
		config?: RequestConfig
	): Promise<T> {
		const { body, headers } = this.serializeBody(data, config);
		return this.request<T>("PATCH", url, body, {
			...config,
			headers,
		});
	}

	public delete<T>(url: string, config?: RequestConfig): Promise<T> {
		const { body, headers } = this.serializeBody(config?.data, config);
		return this.request<T>("DELETE", url, body, {
			...config,
			headers,
		});
	}

	private serializeBody(
		data: unknown,
		config?: RequestConfig
	): { body: string | undefined; headers: Record<string, string> } {
		const headers: Record<string, string> = { ...(config?.headers ?? {}) };

		if (data === undefined) {
			return { body: undefined, headers };
		}

		const contentType =
			headers["Content-Type"] ??
			this.defaultHeaders["Content-Type"] ??
			JSON_CONTENT_TYPE;

		headers["Content-Type"] = contentType;

		const body =
			contentType === JSON_CONTENT_TYPE
				? JSON.stringify(data)
				: (data as string);

		return { body, headers };
	}

	private async request<T>(
		method: HttpMethod,
		url: string,
		body: string | undefined,
		config?: RequestConfig
	): Promise<T> {
		const fullUrl = buildUrl(this.baseURL, url, config?.params);
		console.log(`[FetchApiClient] ${method} ${fullUrl}`);

		const headers: Record<string, string> = { ...this.defaultHeaders };
		if (config?.headers) {
			Object.assign(headers, config.headers);
		}

		const timeoutMs = config?.timeout ?? this.timeout;

		const response = await fetchWithRetry(() =>
			fetchWithTimeout(fullUrl, { method, headers, body }, timeoutMs)
		);

		if (!response.ok) {
			throw new FetchHttpError(
				`Request failed with status ${response.status}`,
				{
					data: await parseBody(response),
					status: response.status,
					config: { url: fullUrl, method },
				}
			);
		}

		return (await parseBody(response)) as T;
	}
}
