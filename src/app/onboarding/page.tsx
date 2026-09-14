"use client";

import Link from "next/link";
import { useState } from "react";

import { RehearsalMark } from "@/components/brand/rehearsal-mark";
import { useRehearsalApplication } from "@/components/providers/rehearsal-provider";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button, Panel, buttonClassName, cx } from "@/components/ui/primitives";
import type { SourceApplication } from "@/domain/events/taxonomy";

const SOURCES: readonly {
  readonly id: Exclude<SourceApplication, "system">;
  readonly label: string;
  readonly detail: string;
  readonly icon: IconName;
}[] = [
  {
    id: "mail",
    label: "Mail",
    detail: "Support reports and customer replies",
    icon: "mail",
  },
  {
    id: "issue_tracker",
    label: "Issue Tracker",
    detail: "Issue creation, routing, and ownership",
    icon: "ticket",
  },
  {
    id: "team_chat",
    label: "Team Chat",
    detail: "Department notifications and handoffs",
    icon: "users",
  },
];

export default function OnboardingPage() {
  const { commands } = useRehearsalApplication();
  const [step, setStep] = useState<1 | 2>(1);
  const [enabled, setEnabled] = useState<
    ReadonlySet<Exclude<SourceApplication, "system">>
  >(() => new Set(SOURCES.map((source) => source.id)));

  function toggleSource(sourceId: Exclude<SourceApplication, "system">) {
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }

  function applyObservationSources() {
    for (const source of SOURCES) {
      if (enabled.has(source.id)) {
        commands.includeApplication(source.id);
      } else {
        commands.excludeApplication(source.id);
      }
    }
  }

  return (
    <main className="onboarding-page">
      <Panel className="onboarding-card">
        <RehearsalMark />
        <div className="onboarding-progress" aria-label={`Step ${step} of 2`}>
          <span className="is-active" />
          <span className={step === 2 ? "is-active" : ""} />
        </div>

        {step === 1 ? (
          <>
            <div className="onboarding-copy">
              <span className="eyebrow">Step 01 · Introduction</span>
              <h1>Teach one workflow by doing it twice.</h1>
              <p>
                Work normally across the replica apps. Rehearsal observes
                semantic intent, compares the traces, and compiles a reusable
                workflow for your review.
              </p>
            </div>
            <div className="onboarding-actions">
              <Link className={buttonClassName("ghost")} href="/">
                Back home
              </Link>
              <Button onClick={() => setStep(2)} variant="primary">
                Continue <Icon name="arrow" size={14} />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="onboarding-copy">
              <span className="eyebrow">Step 02 · Observation sources</span>
              <h1>Choose where Rehearsal may observe.</h1>
              <p>
                These controls govern semantic observation only. You can change
                them from Privacy at any time.
              </p>
            </div>
            <div className="source-grid">
              {SOURCES.map((source) => {
                const selected = enabled.has(source.id);
                return (
                  <button
                    aria-pressed={selected}
                    className={cx("source-option", selected && "is-enabled")}
                    key={source.id}
                    onClick={() => toggleSource(source.id)}
                    type="button"
                  >
                    <span className="source-option__icon">
                      <Icon name={source.icon} size={15} />
                    </span>
                    <span>
                      <strong>{source.label}</strong>
                      <small>{source.detail}</small>
                    </span>
                    <span aria-hidden="true" className="toggle" />
                  </button>
                );
              })}
            </div>
            <div className="safety-notice">
              <Icon name="shield" size={16} />
              <span>
                Credentials, authentication data, payment information,
                coordinates, selectors, and raw keystrokes are ignored.
              </span>
            </div>
            {enabled.size === 0 && (
              <p className="warning-copy">
                Enable at least one source before entering the workspace.
              </p>
            )}
            <div className="onboarding-actions">
              <Button onClick={() => setStep(1)} variant="ghost">
                Back
              </Button>
              <Link
                aria-disabled={enabled.size === 0}
                className={buttonClassName("primary")}
                href={enabled.size === 0 ? "/onboarding" : "/workspace"}
                onClick={(event) => {
                  if (enabled.size === 0) {
                    event.preventDefault();
                    return;
                  }
                  applyObservationSources();
                }}
              >
                Enter workspace <Icon name="arrow" size={14} />
              </Link>
            </div>
          </>
        )}
      </Panel>
    </main>
  );
}
