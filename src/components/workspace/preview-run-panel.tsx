"use client";

import { useState } from "react";

import {
  useRehearsalApplication,
  useRehearsalState,
} from "../providers/rehearsal-provider";
import { RehearsalOrb } from "../brand/rehearsal-orb";
import { Icon } from "../ui/icon";
import { Badge, Button, cx } from "../ui/primitives";
import { getPermissionMetadata } from "../../domain/policy/permission-policy";
import { TEAM_OWNERS } from "../../domain/understanding/team-routing";

export function PreviewRunPanel({
  compact = false,
}: {
  readonly compact?: boolean;
}) {
  const { commands } = useRehearsalApplication();
  const run = useRehearsalState((state) => state.engine.activeRun);
  const phase = useRehearsalState((state) => state.engine.phase);
  const integration = useRehearsalState((state) => state.integration);
  const [busy, setBusy] = useState(false);

  if (run === null) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">
          <Icon name="spark" size={18} />
        </span>
        <strong>No Preview Run prepared</strong>
        <p>
          An active workflow will prepare a resolved plan when a matching report
          arrives.
        </p>
      </div>
    );
  }

  const executing = phase === "executing";
  const finished = phase === "completed" || phase === "cancelled";
  const requiresReview = phase === "needs_review";
  const currentIndex = run.plannedActions.findIndex(
    (action) => action.status === "running",
  );
  const uniquePermissions = [
    ...new Set(run.plannedActions.map((action) => action.permission)),
  ];
  const resultsByAction = new Map(
    run.results.map((result) => [result.actionId, result]),
  );
  const successfulMessageCount = run.plannedActions.filter(
    (action) =>
      (action.action === "send_team_notification" ||
        action.action === "reply_to_customer") &&
      action.status === "succeeded",
  ).length;

  async function execute() {
    setBusy(true);
    try {
      await commands.approveAndExecute("workspace-reviewer");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    try {
      await commands.retryFailedRun();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cx("preview-panel", compact && "preview-panel--compact")}
    >
      <header className="preview-header">
        <RehearsalOrb
          state={
            phase === "completed"
              ? "success"
              : phase === "failed"
                ? "error"
                : executing
                  ? "executing"
                  : "preview_ready"
          }
        />
        <div>
          <span className="eyebrow">Support triage · {run.id}</span>
          <h2>Preview Run Ready</h2>
          <p>{run.trigger.summary}</p>
        </div>
        <div className="preview-header__meta">
          <Badge
            tone={
              run.risk === "low"
                ? "teal"
                : run.risk === "medium"
                  ? "amber"
                  : "rose"
            }
          >
            {run.risk} risk
          </Badge>
          <Badge tone="violet">
            {Math.round(run.confidence.overall * 100)}% confidence
          </Badge>
        </div>
      </header>

      <div className="preview-body">
        <div className="preview-summary">
          <div className="preview-section">
            <h3>Structured understanding</h3>
            <div className="understanding-grid">
              <div className="data-cell">
                <span>Customer</span>
                <strong>
                  {run.resolvedValues.customerName ?? "Needs review"}
                </strong>
              </div>
              <div className="data-cell">
                <span>Category</span>
                <strong>
                  {run.resolvedValues.category.replaceAll("_", " ")}
                </strong>
              </div>
              <div className="data-cell">
                <span>Department</span>
                <strong>
                  {run.resolvedValues.department.replaceAll("_", " ")}
                </strong>
              </div>
              <div className="data-cell">
                <span>Severity</span>
                <strong>{run.resolvedValues.severity}</strong>
              </div>
              <div className="data-cell">
                <span>Owner</span>
                <strong>{run.resolvedValues.owner ?? "Unresolved"}</strong>
              </div>
              <div className="data-cell">
                <span>Tracker</span>
                <strong>{integration.trackerTarget}</strong>
              </div>
            </div>
          </div>

          {phase === "completed" && (
            <div className="preview-section">
              <h3>Verified outcome</h3>
              <div className="understanding-grid">
                <div className="data-cell">
                  <span>Issue</span>
                  <strong>
                    {run.issueReference.actualIssueKey ??
                      run.issueReference.predictedIssueNumber}
                  </strong>
                </div>
                <div className="data-cell">
                  <span>Owner</span>
                  <strong>{run.resolvedValues.owner ?? "Unresolved"}</strong>
                </div>
                <div className="data-cell">
                  <span>Messages</span>
                  <strong>{successfulMessageCount} confirmed</strong>
                </div>
                <div className="data-cell">
                  <span>Estimated savings</span>
                  <strong>
                    {run.metrics.estimatedActionsAvoided} actions ·{" "}
                    {Math.round(run.metrics.estimatedSecondsSaved / 60)} min
                  </strong>
                </div>
              </div>
            </div>
          )}

          {run.adaptations.length > 0 && (
            <div className="preview-section">
              <h3>Adaptations</h3>
              {run.adaptations.map((adaptation) => (
                <div className="adaptation-card" key={adaptation.field}>
                  <strong>
                    {String(adaptation.observedValue)} →{" "}
                    {String(adaptation.adaptedValue)}
                  </strong>
                  <p>
                    {adaptation.rule}. {adaptation.reason}
                  </p>
                </div>
              ))}
            </div>
          )}

          {requiresReview && (
            <div className="preview-section review-box">
              <p>
                {run.reviewRequests[0]?.reason ??
                  "A person must resolve this run."}
              </p>
              <div className="owner-options">
                {TEAM_OWNERS.map((owner) => (
                  <Button
                    compact
                    key={owner}
                    onClick={() =>
                      commands.resolveOwnerReview(owner, "workspace-reviewer")
                    }
                    variant="secondary"
                  >
                    {owner}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="preview-section">
            <h3>Literal report evidence</h3>
            <div className="evidence-list">
              {run.understanding.evidence.map((evidence, index) => (
                <div
                  className="evidence-item"
                  key={`${evidence.field}-${index}`}
                >
                  <span>{evidence.field}</span> “{evidence.excerpt}”
                </div>
              ))}
            </div>
          </div>

          {run.research.references.length > 0 && (
            <div className="preview-section">
              <h3>Research references</h3>
              <div className="evidence-list">
                {run.research.references.map((reference) => (
                  <a
                    className="evidence-item evidence-item--link"
                    href={reference.url}
                    key={reference.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>
                      {reference.source} · {reference.title}
                    </span>{" "}
                    {reference.highlight}
                  </a>
                ))}
              </div>
            </div>
          )}

          {!compact && (
            <>
              <div className="preview-section">
                <h3>External targets</h3>
                <div className="understanding-grid">
                  <div className="data-cell">
                    <span>Issue tracker</span>
                    <strong>{integration.trackerTarget}</strong>
                  </div>
                  <div className="data-cell">
                    <span>Team messaging</span>
                    <strong>{integration.messagingTarget}</strong>
                  </div>
                  <div className="data-cell">
                    <span>Customer mail</span>
                    <strong>{integration.mailTarget}</strong>
                  </div>
                </div>
              </div>
              <div className="preview-section">
                <h3>Requested permissions</h3>
                <div className="evidence-list">
                  {uniquePermissions.map((permission) => {
                    const metadata = getPermissionMetadata(permission);
                    return (
                      <div className="evidence-item" key={permission}>
                        <span>{permission}</span> {metadata.description}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="preview-actions" aria-label="Proposed actions">
          {run.plannedActions.map((action) => {
            const result = resultsByAction.get(action.id);
            const actionTone =
              action.status === "failed"
                ? "rose"
                : action.status === "succeeded"
                  ? "teal"
                  : action.status === "needs_review" ||
                      action.status === "blocked"
                    ? "amber"
                    : action.status === "running" ||
                        action.status === "executing"
                      ? "violet"
                      : "neutral";

            return (
              <article
                className={cx("preview-action", `is-${action.status}`)}
                key={action.id}
              >
                <span className="preview-action__sequence">
                  {action.status === "succeeded" ? (
                    <Icon name="check" size={11} />
                  ) : (
                    action.sequence
                  )}
                </span>
                <div className="preview-action__copy">
                  <strong>{action.title}</strong>
                  <p>{action.detail}</p>
                  {result && (
                    <p className="preview-action__result">{result.summary}</p>
                  )}
                </div>
                <div className="preview-action__meta">
                  <Badge tone="neutral">{action.application}</Badge>
                  <Badge tone="cyan">{action.permission}</Badge>
                  <Badge tone={actionTone}>
                    {action.status.replaceAll("_", " ")}
                  </Badge>
                  {action.requiresApproval && (
                    <Badge tone="violet">approval</Badge>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <footer className="preview-footer">
        <div className="preview-footer__safety">
          <Icon name={finished ? "check" : "lock"} size={13} />
          {executing
            ? `Executing step ${Math.max(1, currentIndex + 1)} of ${run.plannedActions.length}`
            : phase === "completed"
              ? "Adapter-confirmed results verified"
              : phase === "failed"
                ? "Stopped safely; successful work is preserved"
                : "No external changes have been made"}
        </div>
        <div className="preview-footer__actions">
          {!finished && !executing && phase !== "failed" && (
            <Button onClick={() => commands.cancelRun()} variant="ghost">
              Cancel
            </Button>
          )}
          {phase === "failed" && (
            <Button disabled={busy} onClick={retry} variant="danger">
              <Icon name="refresh" size={13} /> Retry failed step
            </Button>
          )}
          {!finished && !executing && phase !== "failed" && (
            <Button
              disabled={requiresReview || busy}
              onClick={execute}
              variant="violet"
            >
              <Icon name="play" size={13} />{" "}
              {requiresReview ? "Resolve review first" : "Approve & execute"}
            </Button>
          )}
        </div>
      </footer>
    </section>
  );
}
