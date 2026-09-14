import type {
  CompiledLearnedPattern,
  PatternField,
} from "../patterns/compilation-types.ts";
import type { IssueUnderstanding } from "../understanding/issue-understanding.ts";
import type { MailMessage } from "../understanding/mail-message.ts";
import { routeDepartment } from "../understanding/team-routing.ts";
import type {
  ResolvedRunValues,
  RunResearchReference,
  VariableResolutionError,
} from "./preview-run-types.ts";
import { composeMessagesForUnderstanding } from "./message-composition.ts";

export interface ResolvePatternVariablesInput {
  readonly pattern: CompiledLearnedPattern;
  readonly message: MailMessage;
  readonly understanding: IssueUnderstanding;
  readonly nextIssueNumber: string;
  readonly issueUrl?: string | null;
  readonly research?: {
    readonly query: string;
    readonly references: readonly RunResearchReference[];
  } | null;
}

export interface VariableResolutionResult {
  readonly complete: boolean;
  readonly values: ResolvedRunValues;
  readonly errors: readonly VariableResolutionError[];
}

interface ResolutionContext {
  readonly input: ResolvePatternVariablesInput;
  readonly values: ResolvedRunValues;
}

type FieldResolver = (context: ResolutionContext) => unknown;

const FIELD_RESOLVERS = {
  channel: ({ values }) => values.teamChannel,
  "report.id": ({ values }) => values.messageId,
  "customer.name": ({ values }) => values.customerName,
  "customer.email": ({ values }) => values.customerEmail,
  "issue.title": ({ values }) => values.issueTitle,
  "issue.description": ({ values }) => values.issueDescription,
  category: ({ values }) => values.category,
  department: ({ values }) => values.department,
  severity: ({ values }) => values.severity,
  labels: ({ values }) => values.labels,
  owner: ({ values }) => values.owner,
  "issue.number": ({ values }) => values.issueNumber,
  "team.message": ({ values }) => values.teamNotification,
  "customer.reply": ({ values }) => values.customerReply,
} as const satisfies Readonly<Record<PatternField, FieldResolver>>;

function isMissingRequiredValue(field: PatternField, value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    if (value.trim().length === 0) {
      return true;
    }

    return field === "department" && value === "unresolved";
  }

  return Array.isArray(value) && value.length === 0;
}

function createResolutionError(field: PatternField): VariableResolutionError {
  const routingField = field === "department" || field === "owner";

  return {
    code: routingField ? "unresolved_routing" : "missing_required_value",
    field,
    message: routingField
      ? `A required routing value could not be resolved for ${field}.`
      : `A required runtime value could not be resolved for ${field}.`,
  };
}

function validateTypedBindings(
  context: ResolutionContext,
): readonly VariableResolutionError[] {
  const errors: VariableResolutionError[] = [];

  for (const variable of context.input.pattern.variables) {
    const binding = variable.binding;
    if (binding.field !== variable.field) {
      throw new TypeError(
        `Pattern variable ${variable.field} contains a mismatched typed binding.`,
      );
    }

    const resolvedValue = FIELD_RESOLVERS[binding.field](context);
    if (
      binding.required &&
      isMissingRequiredValue(binding.field, resolvedValue)
    ) {
      errors.push(createResolutionError(binding.field));
    }
  }

  return errors;
}

export function resolvePatternVariables(
  input: ResolvePatternVariablesInput,
): VariableResolutionResult {
  const route = routeDepartment(input.understanding.issue.department);
  const issueNumber = input.nextIssueNumber.trim();
  const messages = composeMessagesForUnderstanding(
    input.understanding,
    issueNumber,
    route.owner,
    input.issueUrl,
  );
  const values: ResolvedRunValues = {
    messageId: input.message.id.trim(),
    customerName: input.understanding.customer.name,
    customerEmail: input.understanding.customer.email,
    issueTitle: input.understanding.issue.title.trim(),
    issueDescription: input.understanding.issue.description.trim(),
    category: input.understanding.issue.category,
    department: route.department,
    severity: input.understanding.issue.severity,
    labels: [...input.understanding.issue.labels],
    owner: route.owner,
    ownerSource: route.owner === null ? "unresolved" : "routing",
    issueNumber,
    teamChannel: route.channel,
    teamNotification: messages.teamNotification,
    customerReply: messages.customerReply,
    issueUrl: input.issueUrl ?? null,
    researchQuery: input.research?.query ?? null,
    researchReferences: input.research?.references ?? [],
  };
  const context = { input, values } satisfies ResolutionContext;
  const errors = validateTypedBindings(context);

  return {
    complete: errors.length === 0,
    values,
    errors,
  };
}
