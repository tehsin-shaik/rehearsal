import type { CompiledLearnedPattern } from "../patterns/compilation-types.ts";
import {
  DEPARTMENTS,
  routeDepartment,
  type Department,
  type TeamOwner,
} from "../understanding/team-routing.ts";
import type { ResolvedRunValues, RunAdaptation } from "./preview-run-types.ts";

function isDepartment(value: unknown): value is Department {
  return (
    typeof value === "string" &&
    DEPARTMENTS.some((department) => department === value)
  );
}

function representativeValue(
  pattern: CompiledLearnedPattern,
  field: "department" | "owner",
): unknown {
  return pattern.evidence.representativeValues.find(
    (candidate) => candidate.field === field,
  )?.value;
}

function departmentAdaptation(
  pattern: CompiledLearnedPattern,
  department: Department,
): RunAdaptation | null {
  const observedDepartment = representativeValue(pattern, "department");
  if (
    !isDepartment(observedDepartment) ||
    department === "unresolved" ||
    observedDepartment === department
  ) {
    return null;
  }

  const observedName = routeDepartment(observedDepartment).departmentName;
  const adaptedName = routeDepartment(department).departmentName;

  return {
    field: "department",
    from: observedName,
    to: adaptedName,
    observedValue: observedName,
    adaptedValue: adaptedName,
    rule: `${observedDepartment} -> ${department}`,
    reason: `The new report was classified for ${adaptedName} rather than the observed ${observedName} department.`,
    selectedByHuman: false,
  };
}

function ownerAdaptation(
  pattern: CompiledLearnedPattern,
  department: Department,
  owner: TeamOwner | null,
): RunAdaptation | null {
  const observedOwner = representativeValue(pattern, "owner");
  if (
    typeof observedOwner !== "string" ||
    owner === null ||
    observedOwner === owner
  ) {
    return null;
  }

  const route = routeDepartment(department);

  return {
    field: "owner",
    from: observedOwner,
    to: owner,
    observedValue: observedOwner,
    adaptedValue: owner,
    rule: route.rule,
    reason: `${route.departmentName} reports route to ${owner} under the current team rule.`,
    selectedByHuman: false,
  };
}

export function detectRunAdaptations(
  pattern: CompiledLearnedPattern,
  values: ResolvedRunValues,
): readonly RunAdaptation[] {
  return [
    departmentAdaptation(pattern, values.department),
    ownerAdaptation(pattern, values.department, values.owner),
  ].filter((adaptation): adaptation is RunAdaptation => adaptation !== null);
}
