import { redactPayload } from "../../domain/events/redaction.ts";

const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 25;
const MAX_OBJECT_FIELDS = 50;
const MAX_TEXT_LENGTH = 500;

function normalizedFieldName(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePath(path: string): string {
  return path
    .split("?")[0]
    .split("#")[0]
    .replace(/\/browse\/[A-Z][A-Z0-9]+-\d+/gi, "/browse/:issue")
    .replace(/\/t\/[a-z0-9_-]+/gi, "/t/:task")
    .replace(
      /\/(?:[0-9a-f]{8}-[0-9a-f-]{27,}|\d{5,}|[a-z0-9_-]{24,})(?=\/|$)/gi,
      "/:id",
    );
}

function sanitizePathLikeValue(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${normalizePath(url.pathname)}`.slice(
      0,
      MAX_TEXT_LENGTH,
    );
  } catch {
    return normalizePath(value).slice(0, MAX_TEXT_LENGTH);
  }
}

function isPathField(fieldName: string): boolean {
  const normalized = normalizedFieldName(fieldName);
  return (
    normalized === "path" ||
    normalized.endsWith("path") ||
    normalized === "url" ||
    normalized.endsWith("url") ||
    normalized === "href"
  );
}

function sanitizeValue(
  value: unknown,
  fieldName: string,
  depth: number,
): unknown {
  if (depth > MAX_DEPTH) {
    return undefined;
  }

  if (typeof value === "string") {
    return isPathField(fieldName)
      ? sanitizePathLikeValue(value)
      : value.slice(0, MAX_TEXT_LENGTH);
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((entry) => sanitizeValue(entry, fieldName, depth + 1))
      .filter((entry) => entry !== undefined);
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Readonly<Record<string, unknown>>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .slice(0, MAX_OBJECT_FIELDS)
      .flatMap((key) => {
        const sanitized = sanitizeValue(record[key], key, depth + 1);
        return sanitized === undefined ? [] : [[key, sanitized]];
      }),
  );
}

export function sanitizeObservationPayload(
  payload: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const bounded = sanitizeValue(payload, "payload", 0);
  if (
    typeof bounded !== "object" ||
    bounded === null ||
    Array.isArray(bounded)
  ) {
    return {};
  }

  return redactPayload(bounded as Readonly<Record<string, unknown>>);
}
