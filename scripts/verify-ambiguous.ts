import assert from "node:assert/strict";

import { readServerEnvironment } from "../src/config/environment-schema.ts";
import { AmbiguousIssueTrackerAdapter } from "../src/infrastructure/adapters/live/ambiguous-adapter.ts";
import { loadLocalEnvironment } from "./load-local-environment.ts";

await loadLocalEnvironment();
const environment = readServerEnvironment(process.env);
if (
  !environment.AMBIGUOUS_SANDBOX ||
  environment.AMBIGUOUS_BASE_URL === undefined
) {
  process.stdout.write(
    "SKIP Ambiguous verification: AMBIGUOUS_SANDBOX and AMBIGUOUS_BASE_URL are not configured.\n",
  );
  process.exit(0);
}
if (process.env.REHEARSAL_ALLOW_EXTERNAL_WRITES !== "true") {
  process.stdout.write(
    "SKIP Ambiguous verification: set REHEARSAL_ALLOW_EXTERNAL_WRITES=true to authorize disposable sandbox writes.\n",
  );
  process.exit(0);
}

const adapter = new AmbiguousIssueTrackerAdapter({
  baseUrl: environment.AMBIGUOUS_BASE_URL,
  sandbox: true,
});
let verificationError: unknown = null;
try {
  const created = await adapter.createIssue({
    actionId: "ambiguous-sandbox-verification",
    idempotencyKey: `ambiguous-verification-${Date.now()}`,
    attemptedAt: new Date().toISOString(),
    predictedIssueNumber: "VERIFY-1",
    title: "Rehearsal disposable sandbox verification",
    description: "Disposable integration verification; no customer data.",
    category: "data",
    department: "technical_support",
    severity: "low",
    labels: ["rehearsal-verification"],
    customerName: "Verification Customer",
    customerEmail: "verification@example.test",
  });
  assert.equal(created.ok, true);
  assert.ok(created.data?.issue.id);
  process.stdout.write(
    "PASS Ambiguous sandbox create and read-back verification.\n",
  );
} catch (error) {
  verificationError = error;
} finally {
  const revoked = await adapter.revokeSandbox();
  assert.equal(revoked, true, "The Ambiguous sandbox session must be revoked.");
  process.stdout.write("PASS Ambiguous sandbox session revocation.\n");
}
if (verificationError !== null) {
  throw verificationError;
}
