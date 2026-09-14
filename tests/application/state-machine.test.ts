import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  assertPhaseTransition,
  canTransition,
  InvalidPhaseTransitionError,
  phaseTransitionsFrom,
} from "../../src/application/state-machine/phases.ts";

test("valid application phase transitions are explicit", () => {
  assert.equal(canTransition("idle", "observing"), true);
  assert.equal(canTransition("observing", "comparing"), true);
  assert.equal(canTransition("comparing", "pattern_discovered"), true);
  assert.equal(canTransition("preview_ready", "executing"), true);
  assert.equal(canTransition("failed", "executing"), true);
  assert.deepEqual(phaseTransitionsFrom("needs_review"), [
    "preview_ready",
    "cancelled",
  ]);
  assert.doesNotThrow(() => assertPhaseTransition("executing", "completed"));
});

test("invalid application phase transitions are rejected", () => {
  assert.equal(canTransition("idle", "executing"), false);
  assert.throws(
    () => assertPhaseTransition("pattern_discovered", "executing"),
    (error: unknown) =>
      error instanceof InvalidPhaseTransitionError &&
      error.from === "pattern_discovered" &&
      error.to === "executing",
  );
});
