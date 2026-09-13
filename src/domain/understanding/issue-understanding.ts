import type { Department } from "./routing.ts";
export interface IssueUnderstanding {
    readonly reportId: string;
    readonly customer: {
        readonly name: string | null;
        readonly email: string | null;
    };
    readonly issue: {
        readonly title: string;
        readonly description: string;
        readonly category: "authentication" | "api_timeout" | "billing" | "sales" | "logistics" | "product" | "privacy" | "unresolved";
        readonly department: Department;
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
    readonly provenance?: {
        readonly provider: string;
        readonly model: string;
        readonly validated: boolean;
        readonly latencyMs: number;
        readonly fallbackReason?: string;
    };
    readonly research?: readonly {
        readonly title: string;
        readonly url: string;
        readonly excerpt: string;
        readonly source: string;
    }[];
    readonly researchQuery?: string;
}
