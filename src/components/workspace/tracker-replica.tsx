"use client";

import { TEAM_OWNERS } from "../../domain/understanding/team-routing";
import {
  useRehearsalApplication,
  useRehearsalState,
} from "../providers/rehearsal-provider";
import { Icon } from "../ui/icon";
import {
  Badge,
  Button,
  FormField,
  GuideRing,
  WindowFrame,
} from "../ui/primitives";

export function TrackerReplica() {
  const { commands } = useRehearsalApplication();
  const workspace = useRehearsalState((state) => state.workspace);
  const integration = useRehearsalState((state) => state.integration);
  const phase = useRehearsalState((state) => state.engine.phase);
  const composer = workspace.trackerComposer;
  const lastManualIssue = [...workspace.replicaIssues]
    .reverse()
    .find((issue) => issue.source === "manual" && issue.owner === null);

  return (
    <WindowFrame
      action={
        integration.mode === "live" &&
        integration.trackerSurfaces.length > 0 ? (
          <label className="surface-switcher">
            <span>Tracker</span>
            <select
              aria-label="Connected issue tracker"
              className="select select--compact"
              onChange={(event) =>
                commands.selectTrackerSurface(event.target.value)
              }
              value={integration.selectedTrackerSurfaceId ?? ""}
            >
              <option disabled value="">
                Select target
              </option>
              {integration.trackerSurfaces.map((surface) => (
                <option
                  disabled={
                    surface.status === "unavailable" ||
                    surface.status === "error"
                  }
                  key={surface.id}
                  value={surface.id}
                >
                  {surface.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Badge tone={integration.mode === "demo" ? "teal" : "cyan"}>
            {integration.selectedTrackerSurfaceId ?? "Replica"}
          </Badge>
        )
      }
      className="tracker-window"
      icon="ticket"
      identity="Issue tracker"
      title={integration.trackerTarget}
    >
      <div className="tracker-layout">
        <div className="tracker-toolbar">
          <span className="eyebrow">
            Open issues · {workspace.replicaIssues.length}
          </span>
          <div style={{ display: "flex", gap: 5 }}>
            {lastManualIssue && composer.owner && (
              <Button
                compact
                onClick={() => {
                  if (composer.owner !== null) {
                    commands.assignOwner(composer.owner);
                  }
                }}
                variant="ghost"
              >
                <Icon name="users" size={11} /> Assign {composer.owner}
              </Button>
            )}
            <GuideRing
              active={
                phase === "observing" &&
                workspace.structuredUnderstanding === null
              }
            >
              <Button
                compact
                onClick={() => commands.openTrackerComposer()}
                variant="secondary"
              >
                <Icon name="plus" size={11} /> New issue
              </Button>
            </GuideRing>
          </div>
        </div>
        <div className="tracker-list">
          {[...workspace.replicaIssues].reverse().map((issue) => (
            <article className="issue-row" key={issue.id}>
              <a
                className="issue-row__key"
                href={issue.url ?? undefined}
                rel="noreferrer"
                target={issue.url ? "_blank" : undefined}
              >
                {issue.key}
              </a>
              <div>
                <span className="issue-row__title">{issue.title}</span>
                <div className="label-list">
                  {issue.labels.slice(0, 2).map((label) => (
                    <Badge key={label}>{label}</Badge>
                  ))}
                </div>
              </div>
              <div className="issue-row__meta">
                <span>{issue.priority}</span>
                <span>·</span>
                <span>{issue.owner ?? "unassigned"}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      {composer.open && (
        <div
          className="composer-overlay"
          role="dialog"
          aria-label="Create support issue"
        >
          <div className="composer-actions">
            <Button
              compact
              onClick={() => commands.populateIssueFields()}
              variant="primary"
            >
              <Icon name="spark" size={11} /> Populate from report
            </Button>
          </div>
          <FormField label="Title" readOnly value={composer.title} />
          <label className="form-field">
            <span className="form-field__label">Description</span>
            <textarea
              className="textarea"
              readOnly
              value={composer.description}
            />
          </label>
          <div className="composer-grid">
            <label className="form-field">
              <span className="form-field__label">Priority</span>
              <select
                className="select"
                onChange={(event) =>
                  commands.setPriority(
                    event.target.value as "low" | "medium" | "high",
                  )
                }
                value={composer.priority}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="form-field">
              <span className="form-field__label">Owner</span>
              <select
                className="select"
                onChange={(event) =>
                  commands.assignOwner(
                    event.target.value as (typeof TEAM_OWNERS)[number],
                  )
                }
                value={composer.owner ?? ""}
              >
                <option disabled value="">
                  Select owner
                </option>
                {TEAM_OWNERS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="form-field__label">Labels</span>
            <div className="label-list">
              {composer.labels.map((label) => (
                <Badge key={label} tone="cyan">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="composer-actions">
            <Button
              compact
              onClick={() => commands.applyLabels()}
              variant="ghost"
            >
              Apply labels
            </Button>
            <Button
              compact
              disabled={!composer.title}
              onClick={() => commands.createIssueManually()}
              variant="primary"
            >
              Create issue
            </Button>
          </div>
        </div>
      )}
    </WindowFrame>
  );
}
