import type {
  TeamChannel,
  TrackerComposerState,
  WorkspaceSlice,
} from "./types.ts";

export const EMPTY_TRACKER_COMPOSER: TrackerComposerState = {
  open: false,
  sourceMessageId: null,
  title: "",
  description: "",
  labels: [],
  priority: "medium",
  owner: null,
};

export const DEFAULT_TEAM_CHANNELS: readonly TeamChannel[] = [
  {
    id: "#technical-support",
    label: "technical-support",
    description: "Authentication, performance, and API reports",
  },
  {
    id: "#billing-finance",
    label: "billing-finance",
    description: "Billing and invoice operations",
  },
  {
    id: "#sales-support",
    label: "sales-support",
    description: "Sales questions and pre-sales support",
  },
  {
    id: "#logistics-support",
    label: "logistics-support",
    description: "Delivery and fulfillment reports",
  },
  {
    id: "#product-development-engineering",
    label: "product-development-engineering",
    description: "Product defects and engineering escalations",
  },
  {
    id: "#legal-privacy-compliance",
    label: "legal-privacy-compliance",
    description: "Legal, privacy, and compliance review",
  },
  {
    id: "#support-review",
    label: "support-review",
    description: "Reports requiring human routing review",
  },
];

export function createInitialWorkspaceSlice(): WorkspaceSlice {
  return {
    inboxMessages: [],
    selectedMessageId: null,
    clipboardMetadata: null,
    structuredUnderstanding: null,
    trackerComposer: { ...EMPTY_TRACKER_COMPOSER },
    replicaIssues: [
      {
        id: "existing-issue-114",
        key: "SUP-114",
        number: "SUP-114",
        url: null,
        title: "Webhook delivery intermittently delayed",
        description: "Existing demonstration issue.",
        labels: ["support", "performance"],
        priority: "medium",
        owner: "Elyes",
        state: "in_progress",
        createdAt: "2026-01-04T14:20:00.000Z",
        source: "existing",
      },
    ],
    currentIssueNumber: "SUP-1001",
    teamChannels: DEFAULT_TEAM_CHANNELS,
    teamMessages: [
      {
        id: "existing-message-001",
        channel: "#technical-support",
        author: "Elyes",
        message: "Morning queue review is complete.",
        sentAt: "2026-01-05T08:30:00.000Z",
        source: "existing",
      },
    ],
    activeChannel: "#technical-support",
    teamMessageDraft: "",
    customerReplyDraft: "",
    customerReplies: [],
  };
}
