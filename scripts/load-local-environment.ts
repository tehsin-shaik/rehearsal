import { readFile } from "node:fs/promises";

function parsedValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export async function loadLocalEnvironment(): Promise<void> {
  for (const path of [".env", ".env.local"]) {
    try {
      const content = await readFile(path, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (match?.[1] !== undefined && process.env[match[1]] === undefined) {
          process.env[match[1]] = parsedValue(match[2] ?? "");
        }
      }
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }
}
