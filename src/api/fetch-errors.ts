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


	constructor(message: string, response: FetchHttpErrorResponse) {
		super(message);
		this.response = response;
	}
}

export const isFetchHttpError = (e: unknown): e is FetchHttpError =>
	e instanceof FetchHttpError;
