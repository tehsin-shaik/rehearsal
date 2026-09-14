"use client";

import { deduplicateSemanticEvents } from "@/domain/events";

import { useState } from "react";

import { AppPageHeader } from "@/components/site/app-page-header";
import {
  useRehearsalApplication,
  useRehearsalState,
} from "@/components/providers/rehearsal-provider";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Button,
  EmptyState,
  FlatPanel,
  Metric,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";

export default function ActivityPage() {
  const { commands } = useRehearsalApplication();
  const engine = useRehearsalState((state) => state.engine);
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <main className="app-page">
      <div className="app-page__shell">
        <AppPageHeader />
        <section className="page-heading">
          <div className="page-heading__copy">
            <span className="eyebrow">Local audit trail</span>
            <h1>Activity</h1>
            <p>
              Inspect observed semantic events and adapter-confirmed execution
              results. Values remain in this prototype session only.
            </p>
          </div>
          <Button
            onClick={() => {
              if (confirmClear) commands.clearHistory();
              else setConfirmClear(true);
            }}
            variant={confirmClear ? "danger" : "ghost"}
          >
            <Icon name="trash" size={13} />
            {confirmClear ? "Confirm clear" : "Clear history"}
          </Button>
        </section>
        <section className="activity-summary">
          <FlatPanel>
            <Metric
              label="Observed traces"
              value={engine.completedTraces.length}
            />
          </FlatPanel>
          <FlatPanel>
            <Metric
              label="Runs completed"
              value={engine.metrics.completedRuns}
            />
          </FlatPanel>
          <FlatPanel>
            <Metric label="Actions saved" value={engine.metrics.actionsSaved} />
          </FlatPanel>
          <FlatPanel>
            <Metric
              label="Time saved"
              value={`${Math.round(engine.metrics.secondsSaved / 60)}m`}
            />
          </FlatPanel>
        </section>
        <section className="activity-columns">
          <Panel className="activity-column">
            <PanelHeader
              action={<Badge>{engine.completedTraces.length} traces</Badge>}
              eyebrow="Behavior"
              icon="eye"
              title="Observed"
            />
            <div className="activity-column__scroll">
              {engine.completedTraces.length === 0 ? (
                <EmptyState
                  detail="Complete a manual or instant observation in the workspace."
                  icon="eye"
                  title="No observations"
                />
              ) : (
                [...engine.completedTraces].reverse().map((trace) => {
                  const events = deduplicateSemanticEvents(trace.events);

                  return (
                    <div className="activity-group" key={trace.id}>
                      <div className="activity-group__title">
                        <span className="mono">{trace.id}</span>
                        <Badge tone="cyan">{events.length} events</Badge>
                      </div>
                      {events.map((event) => (
                        <div className="activity-row" key={event.id}>
                          <time>{event.occurredAt.slice(11, 19)}</time>
                          <span>
                            {event.action.replaceAll("_", " ")}
                            {event.origin === "inferred" ? " · inferred" : ""}
                          </span>
                          <Badge
                            tone={
                              event.origin === "inferred" ? "violet" : "neutral"
                            }
                          >
                            {event.sourceApplication}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
          <Panel className="activity-column">
            <PanelHeader
              action={<Badge>{engine.runHistory.length} runs</Badge>}
              eyebrow="Adapter results"
              icon="bolt"
              title="Executed"
            />
            <div className="activity-column__scroll">
              {engine.runHistory.length === 0 ? (
                <EmptyState
                  detail="Approved run results appear only after adapter confirmation."
                  icon="bolt"
                  title="No executions"
                />
              ) : (
                [...engine.runHistory].reverse().map((run) => (
                  <div className="activity-group" key={run.id}>
                    <div className="activity-group__title">
                      <span className="mono">{run.id}</span>
                      <Badge
                        tone={
                          run.status === "completed"
                            ? "teal"
                            : run.status === "failed"
                              ? "rose"
                              : "neutral"
                        }
                      >
                        {run.status}
                      </Badge>
                    </div>
                    {run.plannedActions.map((action) => {
                      const result = [...run.results]
                        .reverse()
                        .find((candidate) => candidate.actionId === action.id);
                      return (
                        <div className="activity-row" key={action.id}>
                          <time>
                            {result?.completedAt?.slice(11, 19) ?? "—"}
                          </time>
                          <span>
                            {action.title}
                            {result ? ` · ${result.summary}` : ""}
                          </span>
                          <Badge
                            tone={
                              action.status === "succeeded"
                                ? "teal"
                                : action.status === "failed"
                                  ? "rose"
                                  : "neutral"
                            }
                          >
                            {result?.adapter ?? action.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}
