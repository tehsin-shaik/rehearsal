import { z } from "zod";

import type { SupportReport } from "../../domain/understanding/support-report.ts";
import {
  fetchJsonWithTimeout,
  type FetchImplementation,
} from "../http/index.ts";

const exaResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().nullable().optional(),
      url: z.string().url(),
      highlights: z.array(z.string()).optional(),
      text: z.string().optional(),
    }),
  ),
});

export interface ResearchResult {
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly highlight: string;
}

export interface ResearchResponse {
  readonly query: string;
  readonly results: readonly ResearchResult[];
  readonly status: "completed" | "not_configured" | "demo_disabled" | "failed";
}

export interface ResearchClient {
  searchReport(report: SupportReport): Promise<ResearchResponse>;
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function removeSensitiveQueryValues(
  value: string,
  report: SupportReport,
): string {
  const labeledName = report.body.match(/^Customer:\s*(.+)$/im)?.[1]?.trim();
  const labeledEmail = report.body.match(/^Email:\s*(.+)$/im)?.[1]?.trim();
  let sanitized = value;

  for (const sensitiveValue of [labeledName, labeledEmail, report.id]) {
    if (sensitiveValue !== undefined && sensitiveValue.length > 0) {
      sanitized = sanitized.replaceAll(sensitiveValue, " ");
    }
  }

  return collapseWhitespace(
    sanitized
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
      .replace(
        /\b(?:bearer|token|secret|password|api[_ -]?key)\s*[:=]?\s*\S+/gi,
        " ",
      )
      .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, " ")
      .replace(/\b[a-z0-9_-]{24,}\b/gi, " "),
  );
}

function firstSymptomPhrase(report: SupportReport): string {
  const line = report.body
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(
      (entry) =>
        entry.length > 0 &&
        !entry.toLowerCase().startsWith("customer:") &&
        !entry.toLowerCase().startsWith("email:"),
    );

  return (
    (line ?? "support workflow issue").split(/[.!?]/)[0]?.slice(0, 96) ?? ""
  );
}

function literalTechnicalError(report: SupportReport): string {
  const source = `${report.subject}\n${report.body}`;
  const match = source.match(
    /\b(?:[a-z][a-z0-9 _-]{0,45}\s)?(?:error|exception|failed|timeout|time out|HTTP\s+[45]\d\d)\b[^.\n]{0,60}/i,
  );
  return match?.[0]?.slice(0, 110) ?? "";
}

export function buildSanitizedResearchQuery(report: SupportReport): string {
  const segments = [
    report.subject.slice(0, 160),
    firstSymptomPhrase(report),
    literalTechnicalError(report),
  ];
  const uniqueSegments = [...new Set(segments.map(collapseWhitespace))].filter(
    (segment) => segment.length > 0,
  );
  return removeSensitiveQueryValues(uniqueSegments.join(" | "), report).slice(
    0,
    320,
  );
}

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "external source";
  }
}

function conciseHighlight(value: string | undefined): string {
  return collapseWhitespace(value ?? "No highlight supplied.").slice(0, 280);
}

export class ExaResearchClient implements ResearchClient {
  readonly #apiKey: string | undefined;
  readonly #fetchImplementation: FetchImplementation;

  constructor(
    apiKey: string | undefined,
    fetchImplementation: FetchImplementation = fetch,
  ) {
    this.#apiKey = apiKey;
    this.#fetchImplementation = fetchImplementation;
  }

  async searchReport(report: SupportReport): Promise<ResearchResponse> {
    const query = buildSanitizedResearchQuery(report);
    if (this.#apiKey === undefined) {
      return { query, results: [], status: "not_configured" };
    }

    try {
      const response = await fetchJsonWithTimeout("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.#apiKey,
        },
        body: JSON.stringify({
          query,
          numResults: 3,
          contents: {
            highlights: { maxCharacters: 600 },
          },
        }),
        timeoutMs: 6_000,
        fetchImplementation: this.#fetchImplementation,
      });
      const parsed = exaResponseSchema.safeParse(response);
      if (!parsed.success) {
        return { query, results: [], status: "failed" };
      }

      return {
        query,
        status: "completed",
        results: parsed.data.results.slice(0, 3).map((result) => ({
          title: result.title?.trim() || sourceLabel(result.url),
          url: result.url,
          source: sourceLabel(result.url),
          highlight: conciseHighlight(result.highlights?.[0] ?? result.text),
        })),
      };
    } catch {
      return { query, results: [], status: "failed" };
    }
  }
}
