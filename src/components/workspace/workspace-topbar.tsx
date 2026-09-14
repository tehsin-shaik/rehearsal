"use client";

import Link from "next/link";

import { RehearsalMark } from "../brand/rehearsal-mark";
import {
  useRehearsalApplication,
  useRehearsalState,
} from "../providers/rehearsal-provider";
import { Icon } from "../ui/icon";
import { Button, Kbd, StatusDot, Tooltip, cx } from "../ui/primitives";
import { brand } from "../../config/brand";

export function WorkspaceTopbar() {
  const { commands } = useRehearsalApplication();
  const engine = useRehearsalState((state) => state.engine);
  const presentation = useRehearsalState((state) => state.presentation);
  const learning = ["observing", "comparing", "pattern_discovered"].includes(
    engine.phase,
  );
  const automate = engine.workflows.length > 0;

  function reset() {
    if (!presentation.resetConfirmationPending) {
      commands.requestResetConfirmation();
      return;
    }
    commands.resetApplication();
  }

  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar__brand">
        <RehearsalMark linked state={presentation.orbState} />
        <span className="workspace-tagline">{brand.tagline}</span>
      </div>
      <div className="mode-indicators" aria-label="System modes">
        <span
          className={cx(
            "mode-indicator",
            !engine.observationPaused && "is-active",
          )}
        >
          <StatusDot
            pulse={engine.phase === "observing"}
            tone={!engine.observationPaused ? "cyan" : "neutral"}
          />
          Watch
        </span>
        <span className={cx("mode-indicator", learning && "is-active")}>
          <StatusDot pulse={learning} tone={learning ? "cyan" : "neutral"} />
          Learn
        </span>
        <span className={cx("mode-indicator", automate && "is-active")}>
          <StatusDot tone={automate ? "violet" : "neutral"} />
          Automate
        </span>
      </div>
      <div className="workspace-topbar__actions">
        {engine.metrics.completedRuns > 0 && (
          <div className="topbar-metrics">
            <span className="topbar-metric">
              <span>Actions saved</span>
              <strong>{engine.metrics.actionsSaved}</strong>
            </span>
            <span className="topbar-metric">
              <span>Time saved</span>
              <strong>{Math.round(engine.metrics.secondsSaved / 60)}m</strong>
            </span>
          </div>
        )}
        <Link className="topbar-link" href="/workflows">
          Workflows
        </Link>
        <Link className="topbar-link" href="/privacy">
          Privacy
        </Link>
        <Tooltip
          label={
            presentation.soundEnabled
              ? "Mute interface sound"
              : "Enable interface sound"
          }
        >
          <button
            aria-label={
              presentation.soundEnabled ? "Mute sound" : "Enable sound"
            }
            className="icon-button"
            onClick={() => commands.toggleSound()}
            type="button"
          >
            <Icon
              name={presentation.soundEnabled ? "volume" : "volumeOff"}
              size={14}
            />
          </button>
        </Tooltip>
        <Tooltip label="Open command palette">
          <button
            aria-label="Open command palette"
            className="icon-button"
            onClick={() => commands.setCommandPaletteOpen(true)}
            type="button"
          >
            <Icon name="search" size={13} />
          </button>
        </Tooltip>
        <Kbd>Ctrl/⌘ K</Kbd>
        <Button
          compact
          onBlur={() => commands.clearResetConfirmation()}
          onClick={reset}
          variant={presentation.resetConfirmationPending ? "danger" : "ghost"}
        >
          {presentation.resetConfirmationPending ? "Confirm reset" : "Reset"}
        </Button>
        <span className="workspace-status">
          <StatusDot
            pulse={!engine.observationPaused}
            tone={engine.observationPaused ? "amber" : "teal"}
          />
          {engine.observationPaused ? "Paused" : "Active"}
        </span>
      </div>
    </header>
  );
}
