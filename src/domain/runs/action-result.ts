export interface ActionResult {
  readonly actionId: string;
  readonly status: "succeeded" | "failed" | "not_attempted";
  readonly adapter: string;
  readonly attemptedAt: string | null;
  readonly completedAt: string | null;
  readonly idempotencyKey: string;
  readonly externalReference?: string;
  readonly externalUrl?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  };
}
