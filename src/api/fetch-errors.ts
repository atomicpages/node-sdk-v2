export interface FetchHttpErrorResponse {
	/** Parsed JSON body when possible, otherwise the raw text. */
	data: unknown;
	status: number;
	config: {
		url: string;
		method: string;
	};
}

export class FetchHttpError extends Error {
	public readonly name = "FetchHttpError";
	public readonly response: FetchHttpErrorResponse;
	/** Present for network-layer failures (e.g. "ETIMEDOUT"). */
	public readonly code?: string;

	constructor(message: string, response: FetchHttpErrorResponse, code?: string) {
		super(message);
		this.response = response;
		this.code = code;
	}
}

export const isFetchHttpError = (e: unknown): e is FetchHttpError =>
	e instanceof FetchHttpError;
