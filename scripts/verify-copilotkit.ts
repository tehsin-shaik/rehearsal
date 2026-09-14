import assert from "node:assert/strict";
import { EventType } from "@ag-ui/core";

import {
  apiTimeoutTrace,
  loginAuthenticationTrace,
} from "../src/demo/fixtures/traces.ts";
import { duplicateBillingChargeReport } from "../src/demo/fixtures/reports.ts";
import { compileLearnedPattern } from "../src/domain/patterns/pattern-compiler.ts";
import { understandReportDeterministically } from "../src/domain/understanding/deterministic-understanding.ts";
import { streamPreviewPlanningEvents } from "../src/infrastructure/agents/preview-agent.ts";

const pattern = compileLearnedPattern([
  loginAuthenticationTrace,
  apiTimeoutTrace,
]);
assert.ok(pattern !== null);
const events = [];
for await (const event of streamPreviewPlanningEvents({
  report: duplicateBillingChargeReport,
  pattern,
  understanding: understandReportDeterministically(
    duplicateBillingChargeReport,
  ),
  nextIssueNumber: "SUP-VERIFY",
  research: null,
})) {
  events.push(event);
}

const actionProposals = events.filter(
  (event) =>
    event.type === EventType.TOOL_CALL_START &&
    event.toolCallName === "proposeAction",
);
const runProposals = events.filter(
  (event) =>
    event.type === EventType.TOOL_CALL_START &&
    event.toolCallName === "proposeRun",
);
assert.equal(actionProposals.length, 10);
assert.equal(runProposals.length, 1);
assert.equal(
  events.some(
    (event) =>
      event.type === EventType.TOOL_CALL_START &&
      "toolCallName" in event &&
      ["approve", "execute"].includes(String(event.toolCallName)),
  ),
  false,
);
process.stdout.write(
  "PASS AG-UI shape: 10 action proposals, 1 run proposal, 0 approval or execution tools.\n",
);
