export type FetchImplementation = typeof fetch;

export const MAX_NETWORK_RESPONSE_BYTES = 2_000_000;

export type NetworkErrorCode =
  "timeout" | "network_error" | "invalid_response" | "remote_error";

export class NetworkRequestError extends Error {
  readonly code: NetworkErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    code: NetworkErrorCode,
    message: string,
    options: { readonly status?: number; readonly retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "NetworkRequestError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export interface TimedRequestOptions extends RequestInit {
  readonly timeoutMs: number;
  readonly fetchImplementation?: FetchImplementation;
}

async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > maximumBytes
  ) {
    throw new NetworkRequestError(
      "invalid_response",
      `The remote response exceeded ${maximumBytes} bytes.`,
    );
  }

  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let value = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      value += decoder.decode();
      return value;
    }

    byteCount += chunk.value.byteLength;
    if (byteCount > maximumBytes) {
      await reader.cancel();
      throw new NetworkRequestError(
        "invalid_response",
        `The remote response exceeded ${maximumBytes} bytes.`,
      );
    }
    value += decoder.decode(chunk.value, { stream: true });
  }
}

async function performTimedRequest<Result>(
  url: string | URL,
  options: TimedRequestOptions,
  consume: (response: Response) => Promise<Result>,
): Promise<Result> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  const externalSignal = options.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal !== null && externalSignal !== undefined) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, {
        once: true,
      });
    }
  }

  try {
    const response = await (options.fetchImplementation ?? fetch)(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new NetworkRequestError(
        "remote_error",
        `The remote service returned HTTP ${response.status}.`,
        {
          status: response.status,
          retryable: response.status === 429 || response.status >= 500,
        },
      );
    }

    return await consume(response);
  } catch (error) {
    if (error instanceof NetworkRequestError) {
      throw error;
    }

    if (timedOut) {
      throw new NetworkRequestError(
        "timeout",
        `The remote service did not respond within ${options.timeoutMs}ms.`,
        { retryable: true },
      );
    }

    throw new NetworkRequestError(
      "network_error",
      "The remote service could not be reached.",
      { retryable: true },
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

export function fetchWithTimeout(
  url: string | URL,
  options: TimedRequestOptions,
): Promise<Response> {
  return performTimedRequest(url, options, async (response) => response);
}

export function fetchTextWithTimeout(
  url: string | URL,
  options: TimedRequestOptions,
): Promise<string> {
  return performTimedRequest(url, options, (response) =>
    readBoundedResponseText(response, MAX_NETWORK_RESPONSE_BYTES),
  );
}

export async function fetchJsonWithTimeout(
  url: string | URL,
  options: TimedRequestOptions,
): Promise<unknown> {
  return performTimedRequest(url, options, async (response) => {
    const responseText = await readBoundedResponseText(
      response,
      MAX_NETWORK_RESPONSE_BYTES,
    );
    try {
      return JSON.parse(responseText) as unknown;
    } catch {
      throw new NetworkRequestError(
        "invalid_response",
        "The remote service returned an invalid JSON response.",
      );
    }
  });
}
