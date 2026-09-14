"use client";

import { useState } from "react";

import { AppPageHeader } from "@/components/site/app-page-header";
import {
  useRehearsalApplication,
  useRehearsalState,
} from "@/components/providers/rehearsal-provider";
import { selectStoredObservationCount } from "@/application/store/selectors";
import {
  PERMISSION_CLASSES,
  PERMISSION_POLICY,
} from "@/domain/policy/permission-policy";
import type { SourceApplication } from "@/domain/events/taxonomy";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Button,
  FlatPanel,
  Metric,
  TintedPanel,
} from "@/components/ui/primitives";

const OBSERVATION_APPS: readonly {
  readonly id: SourceApplication;
  readonly label: string;
  readonly detail: string;
}[] = [
  { id: "mail", label: "Mail", detail: "Report reads and customer replies" },
  {
    id: "issue_tracker",
    label: "Issue Tracker",
    detail: "Issue creation and assignment intent",
  },
  {
    id: "team_chat",
    label: "Team Chat",
    detail: "Notification drafting and sending",
  },
];

export default function PrivacyPage() {
  const { commands } = useRehearsalApplication();
  const engine = useRehearsalState((state) => state.engine);
  const integrations = useRehearsalState((state) => state.integration);
  const storedCount = useRehearsalState(selectStoredObservationCount);
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <main className="app-page">
      <div className="app-page__shell">
        <AppPageHeader />
        <section className="page-heading">
          <div className="page-heading__copy">
            <span className="eyebrow">Safety and control</span>
            <h1>Privacy</h1>
            <p>
              Observation is semantic, bounded, and controllable. Policy—not a
              model—decides whether an action may execute.
            </p>
          </div>
          <Button
            onClick={
              engine.observationPaused
                ? commands.resumeObservation
                : commands.pauseObservation
            }
            variant={engine.observationPaused ? "primary" : "secondary"}
          >
            <Icon
              name={engine.observationPaused ? "play" : "pause"}
              size={13}
            />
            {engine.observationPaused
              ? "Resume observation"
              : "Pause observation"}
          </Button>
        </section>
        <section className="privacy-grid">
          <TintedPanel className="privacy-panel" tint="cyan">
            <h2>Rehearsal observes</h2>
            <ul className="privacy-list">
              <li>
                <Icon name="check" size={13} />
                Semantic actions such as reading a report or creating an issue
              </li>
              <li>
                <Icon name="check" size={13} />
                Normalized application identity and action intent
              </li>
              <li>
                <Icon name="check" size={13} />
                Redacted structured fields needed to infer the workflow
              </li>
              <li>
                <Icon name="check" size={13} />
                Adapter-confirmed result summaries
              </li>
            </ul>
          </TintedPanel>
          <TintedPanel className="privacy-panel" tint="rose">
            <h2>Rehearsal ignores</h2>
            <ul className="privacy-list">
              <li>
                <Icon name="close" size={13} />
                Credentials, passwords, tokens, and authentication data
              </li>
              <li>
                <Icon name="close" size={13} />
                Payment cards and sensitive billing information
              </li>
              <li>
                <Icon name="close" size={13} />
                Coordinates, CSS selectors, and raw key information
              </li>
              <li>
                <Icon name="close" size={13} />
                Copied text and arbitrary screen contents
              </li>
            </ul>
          </TintedPanel>
          <FlatPanel className="privacy-panel privacy-controls">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div>
                <h2>Application inclusion</h2>
                <span style={{ color: "var(--mist-500)", fontSize: 10 }}>
                  Changes apply immediately to active semantic observation.
                </span>
              </div>
              <Metric label="Stored observations" value={storedCount} />
            </div>
            {OBSERVATION_APPS.map((application) => {
              const included = !engine.excludedApplications.includes(
                application.id,
              );
              return (
                <div className="application-control" key={application.id}>
                  <div>
                    <strong
                      style={{
                        display: "block",
                        color: "var(--mist-200)",
                        fontSize: 11,
                      }}
                    >
                      {application.label}
                    </strong>
                    <span style={{ color: "var(--mist-500)", fontSize: 9 }}>
                      {application.detail}
                    </span>
                  </div>
                  <Button
                    compact
                    onClick={() =>
                      included
                        ? commands.excludeApplication(application.id)
                        : commands.includeApplication(application.id)
                    }
                    variant={included ? "secondary" : "ghost"}
                  >
                    {included ? "Included" : "Excluded"}
                  </Button>
                </div>
              );
            })}
          </FlatPanel>
          <FlatPanel className="privacy-panel">
            <h2>Permission policy</h2>
            <table className="policy-table">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Allowed</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_CLASSES.map((permission) => {
                  const metadata = PERMISSION_POLICY[permission];
                  return (
                    <tr key={permission}>
                      <td className="mono">{permission}</td>
                      <td>{metadata.allowed ? "Yes" : "Blocked"}</td>
                      <td>{metadata.approvalRequired ? "Required" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </FlatPanel>
          <FlatPanel className="privacy-panel">
            <h2>Connected targets</h2>
            <dl className="definition-list">
              <div className="definition-row">
                <dt>Mode</dt>
                <dd>
                  <Badge tone={integrations.mode === "demo" ? "teal" : "cyan"}>
                    {integrations.mode}
                  </Badge>
                </dd>
              </div>
              <div className="definition-row">
                <dt>Tracker</dt>
                <dd>{integrations.trackerTarget}</dd>
              </div>
              <div className="definition-row">
                <dt>Messaging</dt>
                <dd>{integrations.messagingTarget}</dd>
              </div>
              <div className="definition-row">
                <dt>Mail</dt>
                <dd>{integrations.mailSurface?.label ?? "Replica inbox"}</dd>
              </div>
            </dl>
          </FlatPanel>
          <TintedPanel className="privacy-panel privacy-controls" tint="amber">
            <h2>Prototype limitations</h2>
            <p
              style={{
                color: "var(--mist-400)",
                fontSize: 10,
                lineHeight: 1.7,
              }}
            >
              This MVP does not provide general OS control, arbitrary workflow
              learning, production encryption, or durable persistence. Demo data
              resets with the session. Live credentials remain server-side when
              configured.
            </p>
            <div style={{ marginTop: 14 }}>
              <Button
                onClick={() => {
                  if (confirmClear) commands.clearHistory();
                  else setConfirmClear(true);
                }}
                variant="danger"
              >
                <Icon name="trash" size={13} />
                {confirmClear ? "Confirm clear history" : "Clear local history"}
              </Button>
            </div>
          </TintedPanel>
        </section>
      </div>
    </main>
  );
}
