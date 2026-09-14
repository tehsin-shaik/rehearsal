"use client";

import { useRehearsalState } from "../providers/rehearsal-provider";
import { Badge, EmptyState, PanelHeader, TintedPanel } from "../ui/primitives";
import { CompactMemoryMap } from "./memory-map";

function compactTime(timestamp: string): string {
  return timestamp.slice(11, 19);
}

export function InspectionPanels() {
  const engine = useRehearsalState((state) => state.engine);
  const workflow =
    engine.workflows.find(
      (candidate) => candidate.pattern.id === engine.inspectedPatternId,
    ) ?? engine.workflows[0];
  const run = engine.activeRun;

  return (
    <div className="inspection-grid">
      <TintedPanel className="inspection-panel" tint="cyan">
        <PanelHeader
          action={
            workflow ? (
              <Badge tone={workflow.lifecycle === "active" ? "teal" : "cyan"}>
                {workflow.lifecycle}
              </Badge>
            ) : undefined
          }
          eyebrow="Generalized workflow"
          icon="workflow"
          title="Memory Map"
        />
        <div className="inspection-panel__body">
          <CompactMemoryMap run={run} />
        </div>
      </TintedPanel>

      <TintedPanel className="inspection-panel" tint="amber">
        <PanelHeader
          action={<Badge>{engine.timeline.length} events</Badge>}
          eyebrow="Audit trail"
          icon="activity"
          title="Live Timeline"
        />
        <div className="inspection-panel__body">
          {engine.timeline.length === 0 ? (
            <EmptyState
              detail="Semantic observations and policy decisions appear here."
              icon="activity"
              title="No activity yet"
            />
          ) : (
            <div className="timeline-list">
              {[...engine.timeline]
                .reverse()
                .slice(0, 24)
                .map((entry) => (
                  <article className="timeline-entry" key={entry.id}>
                    <time className="timeline-entry__time">
                      {compactTime(entry.occurredAt)}
                    </time>
                    <div>
                      <strong>{entry.summary}</strong>
                      {entry.detail && <p>{entry.detail}</p>}
                    </div>
                  </article>
                ))}
            </div>
          )}
        </div>
      </TintedPanel>

      <TintedPanel className="inspection-panel" tint="violet">
        <PanelHeader
          action={
            run ? (
              <Badge
                tone={
                  run.status === "completed"
                    ? "teal"
                    : run.status === "failed"
                      ? "rose"
                      : run.status === "needs_review"
                        ? "amber"
                        : "violet"
                }
              >
                {run.status.replaceAll("_", " ")}
              </Badge>
            ) : undefined
          }
          eyebrow="Approval boundary"
          icon="spark"
          title="Preview Run Summary"
        />
        <div className="inspection-panel__body">
          {run === null ? (
            <EmptyState
              detail="An active pattern prepares a resolved plan for a new report."
              icon="spark"
              title="Waiting for a trigger"
            />
          ) : (
            <div className="definition-list">
              <div className="definition-row">
                <dt>Trigger</dt>
                <dd>{run.trigger.message.subject}</dd>
              </div>
              <div className="definition-row">
                <dt>Owner</dt>
                <dd>{run.resolvedValues.owner ?? "Human review required"}</dd>
              </div>
              <div className="definition-row">
                <dt>Actions</dt>
                <dd>
                  {
                    run.plannedActions.filter(
                      (action) => action.status === "succeeded",
                    ).length
                  }
                  /{run.plannedActions.length} confirmed
                </dd>
              </div>
              <div className="definition-row">
                <dt>Risk</dt>
                <dd>
                  {run.risk} · {Math.round(run.confidence.overall * 100)}%
                  confidence
                </dd>
              </div>
              <div className="definition-row">
                <dt>Boundary</dt>
                <dd>
                  {run.approval.status === "approved"
                    ? `Approved by ${run.approval.approvedBy}`
                    : "No external changes before approval"}
                </dd>
              </div>
            </div>
          )}
        </div>
      </TintedPanel>
    </div>
  );
}
