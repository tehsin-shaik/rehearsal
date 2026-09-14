export interface ActionResultError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface ActionResult<ResultData = unknown> {
  readonly actionId: string;
  readonly status: "succeeded" | "failed" | "not_attempted";
  readonly ok: boolean;
  readonly summary: string;
  readonly data?: ResultData;
  readonly adapter: string;
  readonly durationMs: number;
  readonly attemptedAt: string | null;
  readonly completedAt: string | null;
  readonly idempotencyKey: string;
  readonly externalReference?: string;
  readonly error?: ActionResultError;
}
