export interface IssueUnderstanding {
  readonly reportId: string;
  readonly customer: {
    readonly name: string | null;
    readonly email: string | null;
  };
  readonly issue: {
    readonly title: string;
    readonly description: string;
    readonly category:
      "authentication" | "api_timeout" | "billing" | "unresolved";
    readonly department: "technical_support" | "billing" | "unresolved";
    readonly severity: "low" | "medium" | "high" | "unresolved";
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
