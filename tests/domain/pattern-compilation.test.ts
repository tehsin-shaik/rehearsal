import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  compileLearnedPattern,
  type CompiledLearnedPattern,
  type PatternField,
} from "../../src/domain/patterns/index.ts";
import {
  apiTimeoutTrace,
  loginAuthenticationTrace,
} from "../../src/demo/fixtures/index.ts";

function compileCanonicalPattern(): CompiledLearnedPattern {
  const pattern = compileLearnedPattern([
    loginAuthenticationTrace,
    apiTimeoutTrace,
  ]);
  assert.ok(pattern);
  return pattern;
}

function findVariable(pattern: CompiledLearnedPattern, field: PatternField) {
  const variable = pattern.variables.find(
    (candidate) => candidate.field === field,
  );
  assert.ok(variable, `Expected ${field} to be a variable.`);
  return variable;
}

test("the compiler produces the canonical five high-level stages", () => {
  const pattern = compileCanonicalPattern();

  assert.equal(pattern.status, "proposed");
  assert.deepEqual(
    pattern.stages.map((stage) => stage.name),
    [
      "Email",
      "Understand issue",
      "Create ticket",
      "Assign owner",
      "Notify team",
    ],
  );
  assert.equal(pattern.stages.length, 5);
  assert.equal(pattern.trigger.sourceApplication, "mail");
  assert.equal(pattern.trigger.action, "report_received");
  assert.equal(pattern.observationCount, 2);
  assert.deepEqual(pattern.permissions, [
    "read",
    "draft",
    "analyze",
    "create_external",
    "send_message",
  ]);
});

test("customer identity uses typed extracted variable bindings", () => {
  const pattern = compileCanonicalPattern();

  for (const field of ["customer.name", "customer.email"] as const) {
    const variable = findVariable(pattern, field);
    assert.equal(variable.source, "extracted");
    assert.equal(variable.binding.kind, "runtime_variable");
    assert.equal(variable.binding.field, field);
    assert.equal(variable.binding.required, true);
    assert.equal(variable.heldConstant, false);
  }
});

test("issue title and description remain extracted variables", () => {
  const pattern = compileCanonicalPattern();

  for (const field of ["issue.title", "issue.description"] as const) {
    const variable = findVariable(pattern, field);
    assert.equal(variable.source, "extracted");
    assert.equal(variable.binding.derivation, "extracted");
    assert.equal(
      pattern.constants.some((constant) => constant.field === field),
      false,
    );
  }
});

test("classified department stays variable when observations held it constant", () => {
  const pattern = compileCanonicalPattern();
  const department = findVariable(pattern, "department");

  assert.equal(department.source, "classified");
  assert.equal(department.heldConstant, true);
  assert.equal(department.provenance.heldConstant, true);
  assert.match(department.rationale, /held constant/i);
  assert.equal(
    pattern.constants.some((constant) => constant.field === "department"),
    false,
  );
});

test("routed owner stays variable and records department dependency", () => {
  const pattern = compileCanonicalPattern();
  const owner = findVariable(pattern, "owner");

  assert.equal(owner.source, "routed");
  assert.equal(owner.heldConstant, true);
  assert.equal(owner.dependsOn, "department");
  assert.deepEqual(owner.binding.dependency, {
    determinant: "department",
    dependent: "owner",
    expression: "department -> owner",
  });
  assert.ok(
    pattern.dependencies.some(
      (dependency) => dependency.expression === "department -> owner",
    ),
  );
  assert.equal(
    pattern.constants.some((constant) => constant.field === "owner"),
    false,
  );
});

test("generated outputs stay explicit runtime variables", () => {
  const pattern = compileCanonicalPattern();

  for (const field of [
    "issue.number",
    "team.message",
    "customer.reply",
  ] as const) {
    const variable = findVariable(pattern, field);
    assert.equal(variable.source, "generated");
    assert.equal(variable.binding.kind, "runtime_variable");
    assert.equal(variable.heldConstant, false);
  }
});

test("the explicitly authored notification channel remains constant", () => {
  const pattern = compileCanonicalPattern();
  const channel = pattern.constants.find(
    (constant) => constant.field === "channel",
  );

  assert.ok(channel);
  assert.equal(channel.value, "#technical-support");
  assert.equal(channel.derivation, "authored");
  assert.deepEqual(channel.provenance.sourceActions, [
    "send_team_notification",
  ]);
});

test("compiled workflow steps never memorize observed people", () => {
  const serializedSteps = JSON.stringify(compileCanonicalPattern().stages);

  for (const observedName of [
    "Alex Chen",
    "Priya Raman",
    "Maya Chen",
    "Noah Williams",
    "Elyes",
  ]) {
    assert.equal(serializedSteps.includes(observedName), false);
  }
  assert.equal(serializedSteps.includes("{{"), false);
});

test("pattern evidence explains every held-constant generalization", () => {
  const pattern = compileCanonicalPattern();
  const heldConstantEvidence = pattern.evidence.fieldGeneralizations.filter(
    (field) => field.heldConstant,
  );

  assert.deepEqual(
    heldConstantEvidence.map((field) => field.field),
    ["department", "severity", "owner"],
  );
  assert.ok(
    heldConstantEvidence.every((field) =>
      field.rationale.toLowerCase().includes("held constant"),
    ),
  );
  assert.deepEqual(pattern.evidence.matchingTraceIds, [
    "trace-api-002",
    "trace-login-001",
  ]);
  assert.equal(pattern.evidence.sampleSize, 2);
  assert.equal(pattern.evidence.sampleSizeDiscount, 0.666667);
});

test("manual metrics use the leaner matching trace", () => {
  const pattern = compileCanonicalPattern();

  assert.equal(pattern.manualBaselineTraceId, "trace-login-001");
  assert.equal(pattern.observedManualActionCount, 5);
  assert.equal(pattern.estimatedDurationSeconds, 210);
});

test("compilation is deterministic regardless of input ordering", () => {
  const forward = compileLearnedPattern([
    loginAuthenticationTrace,
    apiTimeoutTrace,
  ]);
  const reverse = compileLearnedPattern([
    apiTimeoutTrace,
    loginAuthenticationTrace,
  ]);

  assert.deepEqual(forward, reverse);
});
