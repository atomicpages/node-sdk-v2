import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient, buildUrl, parseBody } from "../src/api/base";

describe("parseBody", () => {
	it("returns undefined for 204 status", async () => {
		const response = new Response(null, { status: 204 });
		expect(await parseBody(response)).toBeUndefined();
	});

	it("returns undefined for empty body", async () => {
		const response = new Response("", { status: 200 });
		expect(await parseBody(response)).toBeUndefined();
	});

	it("parses valid JSON", async () => {
		const data = { key: "value", count: 42 };
		const response = new Response(JSON.stringify(data), { status: 200 });
		expect(await parseBody(response)).toEqual(data);
	});

	it("parses JSON array", async () => {
		const data = [1, 2, 3];
		const response = new Response(JSON.stringify(data), { status: 200 });
		expect(await parseBody(response)).toEqual(data);
	});

	it("returns raw text for non-JSON body", async () => {
		const html = "<html><body>Error</body></html>";
		const response = new Response(html, { status: 200 });
		expect(await parseBody(response)).toBe(html);
	});

	it("returns raw text for plain text body", async () => {
		const text = "plain text response";
		const response = new Response(text, { status: 200 });
		expect(await parseBody(response)).toBe(text);
	});
});

describe("buildUrl", () => {
	const base = "https://example.com/api/v1/";

	it("appends relative path to baseURL", () => {
		expect(buildUrl(base, "secrets/raw")).toBe(
			"https://example.com/api/v1/secrets/raw"
		);
	});

	it("strips leading / from path to avoid double slash", () => {
		expect(buildUrl(base, "/secrets/raw")).toBe(
			"https://example.com/api/v1/secrets/raw"
		);
	});

	it("appends query params correctly", () => {
		const result = buildUrl(base, "secrets", {
			environment: "prod",
			path: "/",
		});
		const url = new URL(result);
		expect(url.searchParams.get("environment")).toBe("prod");
		expect(url.searchParams.get("path")).toBe("/");
	});

	it("excludes undefined params", () => {
		const result = buildUrl(base, "secrets", {
			environment: "prod",
			path: undefined,
		});
		const url = new URL(result);
		expect(url.searchParams.get("environment")).toBe("prod");
		expect(url.searchParams.has("path")).toBe(false);
	});

	it("excludes null params", () => {
		const result = buildUrl(base, "secrets", {
			environment: "prod",
			path: null,
		});
		const url = new URL(result);
		expect(url.searchParams.get("environment")).toBe("prod");
		expect(url.searchParams.has("path")).toBe(false);
	});

	it("handles boolean param values", () => {
		const result = buildUrl(base, "secrets", { includeImports: true });
		const url = new URL(result);
		expect(url.searchParams.get("includeImports")).toBe("true");
	});

	it("handles number param values", () => {
		const result = buildUrl(base, "secrets", { limit: 100 });
		const url = new URL(result);
		expect(url.searchParams.get("limit")).toBe("100");
	});

	it("works with baseURL that has a path component", () => {
		const result = buildUrl(
			"https://app.infisical.com/api/",
			"v3/secrets/raw"
		);
		expect(result).toBe("https://app.infisical.com/api/v3/secrets/raw");
	});

	it("returns baseURL + path when no params provided", () => {
		expect(buildUrl(base, "folders")).toBe(
			"https://example.com/api/v1/folders"
		);
	});
});

describe("serializeBody", () => {
	const baseURL = "https://example.com/api/v1/";

	let fetchSpy: ReturnType<typeof vi.fn>;
	let client: ApiClient;

	beforeEach(() => {
		fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", fetchSpy);
		client = new ApiClient({ baseURL });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const lastFetchInit = (): RequestInit => {
		expect(fetchSpy).toHaveBeenCalled();
		return fetchSpy.mock.calls.at(-1)?.[1] as RequestInit;
	};

	const getHeader = (init: RequestInit, key: string): string | undefined => {
		const headers = init.headers as unknown;
		if (!headers) return undefined;
		if (headers instanceof Headers) return headers.get(key) ?? undefined;
		if (Array.isArray(headers)) {
			const match = headers.find(([k]) => k.toLowerCase() === key.toLowerCase());
			return match?.[1];
		}
		return (headers as Record<string, string>)[key];
	};

	it("JSON-stringifies an object body with default Content-Type", async () => {
		await client.post("/x", { a: 1 });

		const init = lastFetchInit();
		expect(init.body).toBe('{"a":1}');
		expect(getHeader(init, "Content-Type")).toBe("application/json");
	});

	it("JSON-stringifies an object body when application/json is passed explicitly", async () => {
		await client.post(
			"/x",
			{ a: 1 },
			{ headers: { "Content-Type": "application/json" } }
		);

		const init = lastFetchInit();
		expect(init.body).toBe('{"a":1}');
		expect(getHeader(init, "Content-Type")).toBe("application/json");
	});

	it("returns undefined body and no Content-Type when data is undefined", async () => {
		await client.post("/x", undefined);

		const init = lastFetchInit();
		expect(init.body).toBeUndefined();
		expect(getHeader(init, "Content-Type")).toBeUndefined();
	});

	it("form-urlencodes a plain object when Content-Type is application/x-www-form-urlencoded", async () => {
		await client.post(
			"/x",
			{ a: 1, b: "x" },
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
		);

		const init = lastFetchInit();
		expect(init.body).toBe("a=1&b=x");
		expect(getHeader(init, "Content-Type")).toBe(
			"application/x-www-form-urlencoded"
		);
	});

	it("drops null and undefined values when form-urlencoding an object", async () => {
		await client.post(
			"/x",
			{ a: 1, b: undefined, c: null, d: "x" },
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
		);

		const init = lastFetchInit();
		expect(init.body).toBe("a=1&d=x");
	});

	it("serializes URLSearchParams for form-urlencoded Content-Type", async () => {
		await client.post(
			"/x",
			new URLSearchParams({ a: "1" }),
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
		);

		const init = lastFetchInit();
		expect(init.body).toBe("a=1");
	});

	it("passes through a pre-encoded string for form-urlencoded Content-Type", async () => {
		await client.post(
			"/x",
			"pre=encoded",
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
		);

		const init = lastFetchInit();
		expect(init.body).toBe("pre=encoded");
	});

	it("throws TypeError when form-urlencoded data is not an object, string, or URLSearchParams", async () => {
		expect(() =>
			client.post("/x", 42, {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			})
		).toThrow(TypeError);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("passes through a string body for non-JSON, non-form Content-Type", async () => {
		await client.post("/x", "raw string", {
			headers: { "Content-Type": "text/plain" },
		});

		const init = lastFetchInit();
		expect(init.body).toBe("raw string");
		expect(getHeader(init, "Content-Type")).toBe("text/plain");
	});

	it("throws TypeError when non-JSON Content-Type receives a non-string body", async () => {
		expect(() =>
			client.post("/x", { a: 1 }, { headers: { "Content-Type": "text/plain" } })
		).toThrow(/pre-serialized string/);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
