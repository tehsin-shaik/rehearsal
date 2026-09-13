export type HttpClient = typeof fetch;
export class IntegrationError extends Error {
    readonly retryable: boolean;
    readonly code: string;
    constructor(code: string, message: string, retryable = false) { super(message); this.name = "IntegrationError"; this.code = code; this.retryable = retryable; }
}
export async function requestJson(url: string, init: RequestInit = {}, client: HttpClient = fetch, timeoutMs = 8000): Promise<unknown> {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:")
        throw new IntegrationError("INVALID_ENDPOINT", "Integration endpoints must use HTTPS.");
    const response = await client(url, { ...init, redirect: "error", signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
    if (!response.ok)
        throw new IntegrationError(`HTTP_${response.status}`, `The integration returned HTTP ${response.status}.`, response.status === 429);
    if (response.status === 204)
        return {};
    const text = await response.text();
    if (!text)
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        throw new IntegrationError("INVALID_RESPONSE", "The integration returned an invalid response.");
    }
}
export function jsonRequest(method: string, body: unknown, headers: Record<string, string> = {}): RequestInit { return { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }; }
