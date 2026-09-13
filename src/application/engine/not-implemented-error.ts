export class NotImplementedError extends Error {
  constructor(operation: string) {
    super(
      `Milestone 0 defines ${operation}, but its engine implementation is intentionally pending.`,
    );
    this.name = "NotImplementedError";
  }
}
