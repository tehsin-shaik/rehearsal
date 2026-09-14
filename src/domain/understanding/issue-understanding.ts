import type { Department } from "./team-routing.ts";

export type IssueCategory =
  | "authentication"
  | "performance"
  | "data"
  | "api_timeout"
  | "billing"
  | "unresolved";

export type IssueSeverity = "low" | "medium" | "high" | "unresolved";

export interface IssueUnderstanding {
  readonly reportId: string;
  readonly customer: {
    readonly name: string | null;
    readonly email: string | null;
  };
  readonly issue: {
    readonly title: string;
    readonly description: string;
    readonly category: IssueCategory;
    readonly department: Department;
    readonly severity: IssueSeverity;
    readonly labels: readonly string[];
  };
  readonly owner: string | null;
  readonly evidence: readonly {
    readonly field: string;
    readonly excerpt: string;
  }[];
  readonly confidence: {
    readonly overall: number;
    readonly byField: Readonly<Record<string, number>>;
  };
  readonly reviewRequired: boolean;
}
