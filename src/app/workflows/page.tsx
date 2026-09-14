"use client";

import Link from "next/link";

import { AppPageHeader } from "@/components/site/app-page-header";
import { useRehearsalState } from "@/components/providers/rehearsal-provider";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  ConfidenceBar,
  EmptyState,
  Metric,
  TintedPanel,
  buttonClassName,
} from "@/components/ui/primitives";

export default function WorkflowsPage() {
  const workflows = useRehearsalState((state) => state.engine.workflows);
  return (
    <main className="app-page">
      <div className="app-page__shell">
        <AppPageHeader />
        <section className="page-heading">
          <div className="page-heading__copy">
            <span className="eyebrow">Compiled memory</span>
            <h1>Workflows</h1>
            <p>
              Review generalized behavior, evidence, routing rules, and measured
              outcomes.
            </p>
          </div>
          <Badge tone={workflows.length ? "cyan" : "neutral"}>
            {workflows.length} learned
          </Badge>
        </section>
        {workflows.length === 0 ? (
          <TintedPanel tint="cyan">
            <EmptyState
              action={
                <Link className={buttonClassName("primary")} href="/workspace">
                  Teach a workflow
                </Link>
              }
              detail="Complete two similar support-triage traces in the workspace. Rehearsal will compile the repeated behavior for review."
              icon="search"
              title="Nothing learned yet"
            />
          </TintedPanel>
        ) : (
          <section className="card-grid">
            {workflows.map((workflow) => (
              <TintedPanel
                className="workflow-card"
                key={workflow.pattern.id}
                tint={workflow.lifecycle === "active" ? "teal" : "cyan"}
              >
                <div className="workflow-card__header">
                  <div>
                    <span className="eyebrow">{workflow.pattern.id}</span>
                    <h2>Support report triage</h2>
                    <p>
                      Mail report → structured issue → routed owner → team
                      notification
                    </p>
                  </div>
                  <Badge
                    tone={
                      workflow.lifecycle === "active"
                        ? "teal"
                        : workflow.lifecycle === "paused"
                          ? "amber"
                          : "cyan"
                    }
                  >
                    {workflow.lifecycle}
                  </Badge>
                </div>
                <div className="workflow-card__metrics">
                  <Metric
                    label="Observations"
                    value={workflow.pattern.observationCount}
                  />
                  <Metric
                    label="Successful runs"
                    value={workflow.successfulRuns}
                  />
                  <Metric label="Actions saved" value={workflow.actionsSaved} />
                  <Metric
                    label="Time saved"
                    value={`${Math.round(workflow.secondsSaved / 60)}m`}
                  />
                  <div style={{ gridColumn: "1 / -1" }}>
                    <ConfidenceBar value={workflow.pattern.confidence} />
                  </div>
                </div>
                <div className="workflow-card__footer">
                  <span
                    className="mono"
                    style={{ color: "var(--mist-500)", fontSize: 9 }}
                  >
                    {workflow.pattern.stages.length} stages ·{" "}
                    {workflow.pattern.variables.length} variables
                  </span>
                  <Link
                    className={buttonClassName("ghost", true)}
                    href={`/workflows/${workflow.pattern.id}`}
                  >
                    View details <Icon name="arrow" size={11} />
                  </Link>
                </div>
              </TintedPanel>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
