import type {
  CompiledPatternConstant,
  CompiledPatternVariable,
  CompiledWorkflowStage,
  PatternField,
  WorkflowFieldBinding,
} from "./compilation-types.ts";

function createStageBinding(
  field: PatternField,
  direction: WorkflowFieldBinding["direction"],
  variablesByField: ReadonlyMap<PatternField, CompiledPatternVariable>,
  constantFields: ReadonlySet<PatternField>,
): WorkflowFieldBinding {
  const variable = variablesByField.get(field);
  if (variable !== undefined) {
    return { kind: "variable", binding: variable.binding, direction };
  }

  if (constantFields.has(field)) {
    return { kind: "constant", field, direction };
  }

  throw new TypeError(
    `Workflow stage references an unclassified field: ${field}`,
  );
}

export function generateWorkflowStages(
  variables: readonly CompiledPatternVariable[],
  constants: readonly CompiledPatternConstant[],
): readonly CompiledWorkflowStage[] {
  const variablesByField = new Map(
    variables.map((variable) => [variable.field, variable]),
  );
  const constantFields = new Set(constants.map((constant) => constant.field));
  const binding = (
    field: PatternField,
    direction: WorkflowFieldBinding["direction"],
  ): WorkflowFieldBinding =>
    createStageBinding(field, direction, variablesByField, constantFields);

  return [
    {
      id: "stage-email",
      order: 1,
      name: "Email",
      intent: "Receive the support email and prepare a customer response",
      sourceApplication: "mail",
      action: "report_received",
      permissions: ["read", "draft"],
      bindings: [
        binding("report.id", "output"),
        binding("customer.reply", "output"),
      ],
    },
    {
      id: "stage-understand-issue",
      order: 2,
      name: "Understand issue",
      intent: "Extract and classify the reported issue",
      sourceApplication: "system",
      action: "classify_report",
      permissions: ["analyze"],
      bindings: [
        binding("report.id", "input"),
        binding("customer.name", "output"),
        binding("customer.email", "output"),
        binding("issue.title", "output"),
        binding("issue.description", "output"),
        binding("category", "output"),
        binding("department", "output"),
        binding("severity", "output"),
        binding("labels", "output"),
      ],
    },
    {
      id: "stage-create-ticket",
      order: 3,
      name: "Create ticket",
      intent: "Create the classified support ticket",
      sourceApplication: "issue_tracker",
      action: "create_issue",
      permissions: ["create_external"],
      bindings: [
        binding("issue.title", "input"),
        binding("issue.description", "input"),
        binding("category", "input"),
        binding("department", "input"),
        binding("severity", "input"),
        binding("labels", "input"),
        binding("issue.number", "output"),
      ],
    },
    {
      id: "stage-assign-owner",
      order: 4,
      name: "Assign owner",
      intent: "Route and assign the ticket owner",
      sourceApplication: "issue_tracker",
      action: "assign_owner",
      permissions: ["create_external"],
      bindings: [
        binding("issue.number", "input"),
        binding("department", "input"),
        binding("owner", "output"),
      ],
    },
    {
      id: "stage-notify-team",
      order: 5,
      name: "Notify team",
      intent: "Generate and send the routed team notification",
      sourceApplication: "team_chat",
      action: "send_team_notification",
      permissions: ["draft", "send_message"],
      bindings: [
        binding("issue.number", "input"),
        binding("owner", "input"),
        binding("channel", "input"),
        binding("team.message", "output"),
      ],
    },
  ];
}
