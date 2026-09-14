import type { ZodType } from "zod";

export const MAX_API_REQUEST_BYTES = 1_000_000;

class RequestBodyTooLargeError extends Error {}

export interface ApiErrorBody {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export type ParsedRequestBody<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly response: Response };

export function apiError(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    { ok: false, error: { code, message } } satisfies ApiErrorBody,
    { status },
  );
}

async function readBoundedRequestBody(
  request: Request,
  maximumBytes: number,
): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > maximumBytes
  ) {
    throw new RequestBodyTooLargeError();
  }

  if (request.body === null) {
    return "";
  }

  const reader = request.body.getReader();
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
      throw new RequestBodyTooLargeError();
    }
    value += decoder.decode(chunk.value, { stream: true });
  }
}

export async function parseRequestBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParsedRequestBody<T>> {
  let body: unknown;
  try {
    body = JSON.parse(
      await readBoundedRequestBody(request, MAX_API_REQUEST_BYTES),
    ) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        ok: false,
        response: apiError(
          413,
          "request_too_large",
          `Request bodies cannot exceed ${MAX_API_REQUEST_BYTES} bytes.`,
        ),
      };
    }
    return {
      ok: false,
      response: apiError(400, "invalid_json", "Request body must be JSON."),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(
        400,
        "invalid_request",
        "Request body did not match the required schema.",
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
