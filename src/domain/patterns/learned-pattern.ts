import type { SemanticEvent } from "../events/semantic-event.ts";

export interface LearnedPattern {
  readonly id: string;
  readonly status: "proposed" | "active" | "archived";
  readonly trigger: {
    readonly sourceApplication: "mail";
    readonly action: "report_received";
    readonly intent: string;
  };
  readonly stages: readonly {
    readonly id: string;
    readonly order: number;
    readonly intent: string;
    readonly sourceApplication: SemanticEvent["sourceApplication"];
    readonly action: SemanticEvent["action"];
  }[];
  readonly variables: readonly {
    readonly field: string;
    readonly source:
      "authored" | "extracted" | "classified" | "routed" | "generated";
    readonly dependsOn?: string;
    readonly rationale: string;
  }[];
  readonly constants: readonly {
    readonly field: string;
    readonly value: unknown;
    readonly rationale: string;
  }[];
  readonly permissions: readonly (
    | "read"
    | "analyze"
    | "draft"
    | "create_external"
    | "send_message"
    | "delete"
    | "payment"
  )[];
  readonly confidence: number;
  readonly evidence: {
    readonly matchingTraceIds: readonly string[];
    readonly sampleSize: number;
    readonly actionSequenceSimilarity: number;
    readonly applicationSetSimilarity: number;
    readonly intentSimilarity: number;
  };
  readonly observedManualActionCount: number;
  readonly estimatedDurationSeconds: number;
}
