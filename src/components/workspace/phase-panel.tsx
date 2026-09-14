"use client";

import { useState } from "react";

import { deduplicateSemanticEvents } from "@/domain/events";

import {
  useRehearsalApplication,
  useRehearsalState,
} from "../providers/rehearsal-provider";
import { RehearsalOrb } from "../brand/rehearsal-orb";
import { Icon } from "../ui/icon";
import {
  Badge,
  Button,
  ConfidenceBar,
  Metric,
  TintedPanel,
  cx,
} from "../ui/primitives";
import { PreviewRunPanel } from "./preview-run-panel";

export function PhasePanel() {
  const { commands, director } = useRehearsalApplication();
  const engine = useRehearsalState((state) => state.engine);
  const workspace = useRehearsalState((state) => state.workspace);
  const patternCollapseActive = useRehearsalState(
    (state) => state.presentation.patternCollapseActive,
  );
  const [busy, setBusy] = useState(false);
  const pattern =
    engine.workflows.find(
      (workflow) => workflow.pattern.id === engine.inspectedPatternId,
    ) ?? engine.workflows[0];

  async function runObservation(sequence: 1 | 2) {
    setBusy(true);
    try {
      if (sequence === 1) await director.runObservationOneInstantly();
      else await director.runObservationTwoInstantly();
    } finally {
      setBusy(false);
    }
  }

  if (
    engine.phase === "preview_ready" ||
    engine.phase === "needs_review" ||
    engine.phase === "executing" ||
    engine.phase === "completed" ||
    engine.phase === "failed"
  ) {
    return <PreviewRunPanel />;
  }

  if (engine.phase === "observing") {
    const events = deduplicateSemanticEvents(engine.activeTrace?.events ?? []);
    return (
      <TintedPanel
        className={cx(
          "phase-content",
          patternCollapseActive && "is-pattern-collapse",
        )}
        tint="cyan"
      >
        <div className="phase-content__main">
          <div className="phase-content__identity">
            <RehearsalOrb state="learning" />
            <div>
              <span className="eyebrow">
                Observation {engine.completedTraces.length + 1} of 2
              </span>
              <h1>Learning the semantic workflow</h1>
            </div>
          </div>
          <p>
            Continue the support-triage work in the replica applications. Latent
            extraction and classification steps appear automatically.
          </p>
          <div className="semantic-step-list">
            {events.map((event) => (
              <span className="semantic-step" key={event.id}>
                <span>{event.origin === "inferred" ? "◇" : "●"}</span>
                {event.action.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          {engine.completedTraces.length > 0 && (
            <ConfidenceBar
              label="Live match confidence"
              value={engine.liveConfidence}
            />
          )}
        </div>
        <div className="phase-metrics">
          <div className="phase-metric-card">
            <Metric label="Semantic steps" value={events.length} />
          </div>
          <div className="phase-metric-card">
            <Metric
              label="Excluded apps"
              value={engine.excludedApplications.length}
            />
          </div>
        </div>
      </TintedPanel>
    );
  }

  if (engine.phase === "comparing") {
    return (
      <TintedPanel className="phase-content" tint="cyan">
        <div className="phase-content__main">
          <span className="eyebrow">Trace comparison</span>
          <h1>Finding repeated intent</h1>
          <p>
            Action order, application set, and semantic intent are being
            compared with a weighted deterministic score.
          </p>
        </div>
        <div className="comparison-visual" aria-label="Comparing two traces">
          <div className="trace-stack">
            <span className="trace-line" />
            <span className="trace-line" />
            <span className="trace-line" />
          </div>
          <Icon name="arrow" size={18} />
          <div className="trace-stack">
            <span className="trace-line" />
            <span className="trace-line" />
            <span className="trace-line" />
          </div>
        </div>
      </TintedPanel>
    );
  }

  if (engine.phase === "pattern_discovered" && pattern) {
    return (
      <TintedPanel className="phase-content" tint="cyan">
        <div className="phase-content__main">
          <div className="discovery-card">
            <RehearsalOrb state="pattern_discovered" size="large" />
            <div>
              <span className="eyebrow">Pattern discovered</span>
              <h1>Support triage repeats reliably</h1>
            </div>
          </div>
          <p>
            {pattern.pattern.observationCount} varied traces compiled into five
            stages with generalized customer, issue, department, and owner
            values.
          </p>
          <div className="phase-actions">
            <Button
              onClick={() =>
                commands.inspectDiscoveredPattern(pattern.pattern.id)
              }
              variant="secondary"
            >
              <Icon name="grid" size={13} /> Inspect memory
            </Button>
            <Button
              onClick={() => commands.activatePattern(pattern.pattern.id)}
              variant="primary"
            >
              <Icon name="bolt" size={13} /> Activate workflow
            </Button>
          </div>
        </div>
        <div className="phase-metrics">
          <div className="phase-metric-card">
            <Metric
              label="Observations"
              value={pattern.pattern.observationCount}
            />
          </div>
          <div className="phase-metric-card">
            <Metric label="Stages" value={pattern.pattern.stages.length} />
          </div>
          <div className="phase-metric-card" style={{ gridColumn: "1 / -1" }}>
            <ConfidenceBar value={pattern.pattern.confidence} />
          </div>
        </div>
      </TintedPanel>
    );
  }

  if (engine.phase === "agent_ready") {
    return (
      <TintedPanel className="phase-content" tint="teal">
        <div className="phase-content__main">
          <div className="phase-content__identity">
            <RehearsalOrb state="idle" />
            <div>
              <span className="eyebrow">Workflow active</span>
              <h1>Ready for the next support report</h1>
            </div>
          </div>
          <p>
            The next matching unread report will trigger planning. Rehearsal
            will resolve the complete Preview Run without making external
            changes.
          </p>
          <div className="phase-actions">
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void director
                  .deliverBillingReport()
                  .finally(() => setBusy(false));
              }}
              variant="primary"
            >
              <Icon name="mail" size={13} /> Deliver unseen billing report
            </Button>
            <Button onClick={() => commands.pausePattern()} variant="ghost">
              <Icon name="pause" size={13} /> Pause workflow
            </Button>
          </div>
        </div>
        <div className="phase-metrics">
          <div className="phase-metric-card">
            <Metric label="Trigger" value="MAIL" />
          </div>
          <div className="phase-metric-card">
            <Metric label="Approval" value="REQUIRED" />
          </div>
        </div>
      </TintedPanel>
    );
  }

  if (engine.phase === "trigger_detected" || engine.phase === "planning") {
    return (
      <TintedPanel className="phase-content" tint="violet">
        <div className="phase-content__main">
          <div className="phase-content__identity">
            <RehearsalOrb state="preview_ready" />
            <div>
              <span className="eyebrow">
                {engine.phase === "trigger_detected"
                  ? "Trigger detected"
                  : "Planning Preview Run"}
              </span>
              <h1>
                {workspace.inboxMessages.find(
                  (message) => message.id === workspace.selectedMessageId,
                )?.subject ?? "Resolving the new report"}
              </h1>
            </div>
          </div>
          <p>
            Understanding and deterministic routing are resolving every variable
            before the approval boundary.
          </p>
          <div className="semantic-step-list">
            <Badge tone="violet">Understand report</Badge>
            <Badge tone="violet">Resolve owner</Badge>
            <Badge tone="violet">Compose actions</Badge>
            <Badge tone="violet">Evaluate policy</Badge>
          </div>
          {engine.phase === "planning" && engine.planningActionCount > 0 && (
            <div
              aria-label={`${engine.planningActionCount} actions proposed`}
              className="planning-action-list"
            >
              {Array.from(
                { length: engine.planningActionCount },
                (_, index) => (
                  <span
                    className="planning-action"
                    key={`proposed-action-${index + 1}`}
                  >
                    <Icon name="check" size={9} /> Action {index + 1}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
        <Metric
          label="Proposed actions"
          value={
            engine.activeRun?.plannedActions.length ??
            (engine.planningActionCount === 0
              ? "…"
              : engine.planningActionCount)
          }
        />
      </TintedPanel>
    );
  }

  if (engine.phase === "cancelled") {
    return (
      <TintedPanel className="phase-content" tint="amber">
        <div className="phase-content__main">
          <span className="eyebrow">Cancelled</span>
          <h1>The proposed run was cancelled</h1>
          <p>
            No unexecuted action will run. The active workflow remains available
            for the next report.
          </p>
          <div className="phase-actions">
            <Button onClick={() => commands.resumePattern()} variant="primary">
              Return to active workflow
            </Button>
          </div>
        </div>
      </TintedPanel>
    );
  }

  return (
    <TintedPanel className="phase-content" tint="cyan">
      <div className="phase-content__main">
        <div className="phase-content__identity">
          <RehearsalOrb state="idle" />
          <div>
            <span className="eyebrow">Observation ready</span>
            <h1>Teach the support workflow through work</h1>
          </div>
        </div>
        <p>
          Read a support message, create and assign its issue, notify the team,
          then reply. One trace is not enough; perform the workflow again with a
          varied report.
        </p>
        <div className="phase-actions">
          <Button
            disabled={busy}
            onClick={() =>
              void runObservation(engine.completedTraces.length === 0 ? 1 : 2)
            }
            variant="secondary"
          >
            <Icon name="play" size={13} /> Run observation{" "}
            {engine.completedTraces.length === 0 ? "1" : "2"} instantly
          </Button>
        </div>
      </div>
      <div className="phase-metrics">
        <div className="phase-metric-card">
          <Metric
            label="Observed"
            value={`${engine.completedTraces.length}/2`}
          />
        </div>
        <div className="phase-metric-card">
          <Metric label="Mode" value="LOCAL" />
        </div>
      </div>
    </TintedPanel>
  );
}
