export type RunExecutionErrorCode =
  | "already_executing"
  | "already_completed"
  | "invalid_run_state"
  | "missing_issue_reference";

export class RunExecutionError extends Error {
  readonly code: RunExecutionErrorCode;

  constructor(code: RunExecutionErrorCode, message: string) {
    super(message);
    this.name = "RunExecutionError";
    this.code = code;
  }
}
