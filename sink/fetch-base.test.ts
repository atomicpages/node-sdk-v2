import { describe, it, expect } from "vitest";
import { buildUrl, parseBody } from "../src/api/base";

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
