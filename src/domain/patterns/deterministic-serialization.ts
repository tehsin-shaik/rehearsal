export function stableSerialize(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    const fields = Object.keys(record)
      .sort()
      .map(
        (fieldName) =>
          `${JSON.stringify(fieldName)}:${stableSerialize(record[fieldName])}`,
      );
    return `{${fields.join(",")}}`;
  }

  if (typeof value === "undefined") {
    return "undefined";
  }

  if (typeof value === "bigint") {
    return JSON.stringify(`${value.toString()}n`);
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return JSON.stringify(String(value));
  }

  return JSON.stringify(value);
}

export function deterministicIdentifier(
  prefix: string,
  value: unknown,
): string {
  const serializedValue = stableSerialize(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < serializedValue.length; index += 1) {
    hash ^= serializedValue.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
