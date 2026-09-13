export const SOURCE_APPLICATIONS = [
    "mail",
    "issue_tracker",
    "team_chat",
    "system",
] as const;
export type SourceApplication = (typeof SOURCE_APPLICATIONS)[number];
interface SemanticActionDefinition {
    readonly allowedApplications: readonly SourceApplication[];
    readonly defaultIntent: string;
    readonly defaultEstimatedEffortSeconds: number;
    readonly latent: boolean;
}
export const SEMANTIC_ACTION_TAXONOMY = {
    report_received: {
        allowedApplications: ["mail"],
        defaultIntent: "Receive a support report",
        defaultEstimatedEffortSeconds: 0,
        latent: false,
    },
    read_report: {
        allowedApplications: ["mail"],
        defaultIntent: "Read a support report",
        defaultEstimatedEffortSeconds: 20,
        latent: false,
    },
    extract_issue: {
        allowedApplications: ["system"],
        defaultIntent: "Extract structured issue details",
        defaultEstimatedEffortSeconds: 0,
        latent: true,
    },
    classify_report: {
        allowedApplications: ["mail", "system", "issue_tracker"],
        defaultIntent: "Classify the issue for routing",
        defaultEstimatedEffortSeconds: 45,
        latent: true,
    },
    create_issue: {
        allowedApplications: ["issue_tracker"],
        defaultIntent: "Create a support issue",
        defaultEstimatedEffortSeconds: 75,
        latent: false,
    },
    assign_owner: {
        allowedApplications: ["issue_tracker"],
        defaultIntent: "Assign the routed issue owner",
        defaultEstimatedEffortSeconds: 30,
        latent: false,
    },
    draft_team_notification: {
        allowedApplications: ["team_chat"],
        defaultIntent: "Draft a team notification",
        defaultEstimatedEffortSeconds: 45,
        latent: false,
    },
    send_team_notification: {
        allowedApplications: ["team_chat"],
        defaultIntent: "Send a team notification",
        defaultEstimatedEffortSeconds: 10,
        latent: false,
    },
    draft_customer_reply: {
        allowedApplications: ["mail"],
        defaultIntent: "Draft a customer reply",
        defaultEstimatedEffortSeconds: 60,
        latent: false,
    },
    reply_to_customer: {
        allowedApplications: ["mail"],
        defaultIntent: "Reply to the customer",
        defaultEstimatedEffortSeconds: 10,
        latent: false,
    },
} as const satisfies Record<string, SemanticActionDefinition>;
export type SemanticAction = keyof typeof SEMANTIC_ACTION_TAXONOMY;
export function isSemanticAction(value: string): value is SemanticAction {
    return Object.hasOwn(SEMANTIC_ACTION_TAXONOMY, value);
}
export function isSourceApplication(value: string): value is SourceApplication {
    return SOURCE_APPLICATIONS.some((application) => application === value);
}
export function applicationSupportsAction(application: SourceApplication, action: SemanticAction): boolean {
    const allowedApplications = SEMANTIC_ACTION_TAXONOMY[action]
        .allowedApplications as readonly SourceApplication[];
    return allowedApplications.includes(application);
}
