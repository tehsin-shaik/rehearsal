"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AppPageHeader } from "@/components/site/app-page-header";
import {
  useRehearsalApplication,
  useRehearsalState,
} from "@/components/providers/rehearsal-provider";
import { MemoryMap } from "@/components/workspace/memory-map";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Button,
  ConfidenceBar,
  EmptyState,
  FlatPanel,
  Metric,
  TintedPanel,
  buttonClassName,
} from "@/components/ui/primitives";

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const { commands } = useRehearsalApplication();
  const workflows = useRehearsalState((state) => state.engine.workflows);
  const run = useRehearsalState((state) => state.engine.activeRun);
  const [confirmForget, setConfirmForget] = useState(false);
  const workflow =
    workflows.find((candidate) => candidate.pattern.id === params.id) ?? null;

  if (workflow === null) {
    return (
      <main className="app-page">
        <div className="app-page__shell">
          <AppPageHeader />
          <section className="page-heading">
            <div className="page-heading__copy">
              <span className="eyebrow">Workflow memory</span>
              <h1>Workflow not found</h1>
            </div>
          </section>
          <TintedPanel tint="amber">
            <EmptyState
              action={
                <Link className={buttonClassName("primary")} href="/workflows">
                  Back to workflows
                </Link>
              }
              detail="This workflow is not present in the current local session."
              icon="warning"
              title="No matching workflow"
            />
          </TintedPanel>
        </div>
      </main>
    );
  }

  const pattern = workflow.pattern;
  return (
    <main className="app-page">
      <div className="app-page__shell">
        <AppPageHeader />
        <section className="page-heading">
          <div className="page-heading__copy">
            <Link className="site-nav__link" href="/workflows">
              ← Back to workflows
            </Link>
            <span className="eyebrow">{pattern.id}</span>
            <h1>Support report triage</h1>
            <p>
              {pattern.trigger.intent}. Five generalized stages remain behind an
              explicit approval boundary.
            </p>
          </div>
          <div className="phase-actions">
            <Button
              onClick={() =>
                workflow.lifecycle === "active"
                  ? commands.pausePattern(pattern.id)
                  : commands.activatePattern(pattern.id)
              }
              variant={
                workflow.lifecycle === "active" ? "secondary" : "primary"
              }
            >
              {workflow.lifecycle === "active" ? (
                <Icon name="pause" size={13} />
              ) : (
                <Icon name="play" size={13} />
              )}
              {workflow.lifecycle === "active" ? "Pause" : "Activate"}
            </Button>
            <Button
              onClick={() => {
                if (confirmForget) commands.forgetPattern(pattern.id);
                else setConfirmForget(true);
              }}
              variant="danger"
            >
              <Icon name="trash" size={13} />
              {confirmForget ? "Confirm forget" : "Forget"}
            </Button>
          </div>
        </section>

        <section className="activity-summary">
          <FlatPanel>
            <Metric
              label="Confidence"
              value={`${Math.round(pattern.confidence * 100)}%`}
            />
          </FlatPanel>
          <FlatPanel>
            <Metric label="Observations" value={pattern.observationCount} />
          </FlatPanel>
          <FlatPanel>
            <Metric label="Successful runs" value={workflow.successfulRuns} />
          </FlatPanel>
          <FlatPanel>
            <Metric
              label="Manual baseline"
              value={`${Math.round(pattern.estimatedDurationSeconds / 60)}m`}
            />
          </FlatPanel>
        </section>

        <div className="detail-grid">
          <div className="detail-stack">
            <TintedPanel className="detail-panel" tint="cyan">
              <div style={{ height: 420 }}>
                <MemoryMap
                  run={run?.patternId === pattern.id ? run : null}
                  workflow={workflow}
                />
              </div>
            </TintedPanel>
            <TintedPanel className="detail-panel" tint="cyan">
              <h2>Variables and derivations</h2>
              <dl className="definition-list">
                {pattern.variables.map((variable) => (
                  <div className="definition-row" key={variable.field}>
                    <dt>{variable.field}</dt>
                    <dd>
                      <Badge tone="cyan">{variable.source}</Badge>{" "}
                      {variable.rationale}
                      {variable.heldConstant
                        ? " · generalized despite matching observed values"
                        : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </TintedPanel>
            <TintedPanel className="detail-panel" tint="violet">
              <h2>Pattern evidence</h2>
              <dl className="definition-list">
                <div className="definition-row">
                  <dt>Action sequence</dt>
                  <dd>
                    {Math.round(
                      pattern.evidence.actionSequenceSimilarity * 100,
                    )}
                    %
                  </dd>
                </div>
                <div className="definition-row">
                  <dt>Application set</dt>
                  <dd>
                    {Math.round(
                      pattern.evidence.applicationSetSimilarity * 100,
                    )}
                    %
                  </dd>
                </div>
                <div className="definition-row">
                  <dt>Semantic intent</dt>
                  <dd>
                    {Math.round(pattern.evidence.intentSimilarity * 100)}%
                  </dd>
                </div>
                <div className="definition-row">
                  <dt>Sample discount</dt>
                  <dd>
                    {Math.round(pattern.evidence.sampleSizeDiscount * 100)}%
                  </dd>
                </div>
                <div className="definition-row">
                  <dt>Matching traces</dt>
                  <dd className="mono">
                    {pattern.evidence.matchingTraceIds.join(", ")}
                  </dd>
                </div>
              </dl>
              <div style={{ marginTop: 12 }}>
                <ConfidenceBar tone="violet" value={pattern.confidence} />
              </div>
            </TintedPanel>
          </div>
          <div className="detail-stack">
            <TintedPanel
              className="detail-panel"
              tint={workflow.lifecycle === "active" ? "teal" : "amber"}
            >
              <h2>Status</h2>
              <Badge tone={workflow.lifecycle === "active" ? "teal" : "amber"}>
                {workflow.lifecycle}
              </Badge>
            </TintedPanel>
            <FlatPanel className="detail-panel">
              <h2>Trigger conditions</h2>
              <dl className="definition-list">
                <div className="definition-row">
                  <dt>Application</dt>
                  <dd>{pattern.trigger.sourceApplication}</dd>
                </div>
                <div className="definition-row">
                  <dt>Action</dt>
                  <dd>{pattern.trigger.action}</dd>
                </div>
                <div className="definition-row">
                  <dt>Intent</dt>
                  <dd>{pattern.trigger.intent}</dd>
                </div>
              </dl>
            </FlatPanel>
            <FlatPanel className="detail-panel">
              <h2>Constants</h2>
              <dl className="definition-list">
                {pattern.constants.map((constant) => (
                  <div className="definition-row" key={constant.field}>
                    <dt>{constant.field}</dt>
                    <dd>
                      {String(constant.value)} · {constant.rationale}
                    </dd>
                  </div>
                ))}
              </dl>
            </FlatPanel>
            <FlatPanel className="detail-panel">
              <h2>Routing rules</h2>
              <dl className="definition-list">
                {pattern.dependencies.map((dependency) => (
                  <div className="definition-row" key={dependency.expression}>
                    <dt>{dependency.determinant}</dt>
                    <dd>
                      {dependency.expression}; resolves {dependency.dependent}{" "}
                      at runtime.
                    </dd>
                  </div>
                ))}
              </dl>
            </FlatPanel>
            <FlatPanel className="detail-panel">
              <h2>Savings</h2>
              <dl className="definition-list">
                <div className="definition-row">
                  <dt>Actions</dt>
                  <dd>{workflow.actionsSaved}</dd>
                </div>
                <div className="definition-row">
                  <dt>Time</dt>
                  <dd>{Math.round(workflow.secondsSaved / 60)} minutes</dd>
                </div>
              </dl>
            </FlatPanel>
          </div>
        </div>
      </div>
    </main>
  );
}
