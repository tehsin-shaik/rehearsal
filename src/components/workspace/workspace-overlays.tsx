"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DEMO_FAILURE_POINTS,
  type DemoFailurePoint,
} from "../../demo/adapters/in-memory-adapters";
import {
  useRehearsalApplication,
  useRehearsalState,
} from "../providers/rehearsal-provider";
import { Icon, type IconName } from "../ui/icon";
import { Button, Kbd, cx } from "../ui/primitives";

interface PaletteCommand {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly run: () => unknown | Promise<unknown>;
}

export function WorkspaceOverlays() {
  const router = useRouter();
  const { commands, director } = useRehearsalApplication();
  const engine = useRehearsalState((state) => state.engine);
  const presentation = useRehearsalState((state) => state.presentation);
  const integration = useRehearsalState((state) => state.integration);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyControl, setBusyControl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const paletteCommands = useMemo<readonly PaletteCommand[]>(() => {
    const entries: PaletteCommand[] = [
      {
        id: "workspace",
        label: "Open workspace",
        icon: "grid",
        run: () => router.push("/workspace"),
      },
      {
        id: "workflows",
        label: "Open workflows",
        icon: "workflow",
        run: () => router.push("/workflows"),
      },
      {
        id: "activity",
        label: "Open activity",
        icon: "activity",
        run: () => router.push("/activity"),
      },
      {
        id: "privacy",
        label: "Open privacy",
        icon: "shield",
        run: () => router.push("/privacy"),
      },
      {
        id: "observation",
        label: engine.observationPaused
          ? "Resume observation"
          : "Pause observation",
        icon: engine.observationPaused ? "play" : "pause",
        run: engine.observationPaused
          ? commands.resumeObservation
          : commands.pauseObservation,
      },
    ];
    if (engine.activeRun !== null)
      entries.push({
        id: "preview",
        label: "Preview Run",
        icon: "spark",
        run: commands.openPreviewRun,
      });
    if (engine.phase === "preview_ready")
      entries.push({
        id: "execute",
        label: "Approve and execute Preview Run",
        icon: "bolt",
        run: commands.approveAndExecute,
      });
    if (engine.phase === "failed")
      entries.push({
        id: "retry",
        label: "Retry failed run",
        icon: "refresh",
        run: commands.retryFailedRun,
      });
    entries.push(
      {
        id: "reset",
        label: "Reset demo",
        icon: "refresh",
        run: commands.resetApplication,
      },
      {
        id: "sound",
        label: presentation.soundEnabled ? "Mute sound" : "Enable sound",
        icon: presentation.soundEnabled ? "volumeOff" : "volume",
        run: commands.toggleSound,
      },
      {
        id: "guides",
        label: presentation.guideAffordancesEnabled
          ? "Hide guide affordances"
          : "Show guide affordances",
        icon: "eye",
        run: commands.toggleGuideAffordances,
      },
    );
    return entries;
  }, [
    commands,
    engine.activeRun,
    engine.observationPaused,
    engine.phase,
    presentation.guideAffordancesEnabled,
    presentation.soundEnabled,
    router,
  ]);

  const filtered = paletteCommands.filter((command) =>
    command.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        commands.setCommandPaletteOpen(!presentation.commandPaletteOpen);
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        commands.setDemoConsoleOpen(!presentation.demoConsoleOpen);
      }
      if (event.key === "Escape") {
        commands.setCommandPaletteOpen(false);
        commands.setDemoConsoleOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commands, presentation.commandPaletteOpen, presentation.demoConsoleOpen]);

  useEffect(() => {
    if (!presentation.commandPaletteOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setQuery("");
    setActiveIndex(0);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [presentation.commandPaletteOpen]);

  function choose(command: PaletteCommand) {
    commands.setCommandPaletteOpen(false);
    void command.run();
  }

  async function runControl(
    id: string,
    control: () => unknown | Promise<unknown>,
  ) {
    setBusyControl(id);
    try {
      await control();
    } finally {
      setBusyControl(null);
    }
  }

  return (
    <>
      {presentation.commandPaletteOpen && (
        <div
          className="overlay-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            commands.setCommandPaletteOpen(false)
          }
          role="presentation"
        >
          <section
            aria-label="Command palette"
            aria-modal="true"
            className="command-palette"
            role="dialog"
          >
            <div className="palette-search">
              <Icon name="search" size={15} />
              <input
                aria-activedescendant={
                  filtered[activeIndex] === undefined
                    ? undefined
                    : `palette-command-${filtered[activeIndex].id}`
                }
                aria-controls="command-palette-options"
                aria-label="Search commands"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) =>
                      Math.min(filtered.length - 1, index + 1),
                    );
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(0, index - 1));
                  }
                  if (event.key === "Enter" && filtered[activeIndex]) {
                    event.preventDefault();
                    choose(filtered[activeIndex]);
                  }
                }}
                placeholder="Type a command…"
                ref={inputRef}
                value={query}
              />
              <Kbd>Esc</Kbd>
            </div>
            <div
              className="palette-list"
              id="command-palette-options"
              role="listbox"
            >
              {filtered.map((command, index) => (
                <button
                  aria-selected={index === activeIndex}
                  className={cx(
                    "palette-row",
                    index === activeIndex && "is-active",
                  )}
                  id={`palette-command-${command.id}`}
                  key={command.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(command)}
                  role="option"
                  type="button"
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 9,
                    }}
                  >
                    <Icon name={command.icon} size={14} />
                    {command.label}
                  </span>
                  {index === activeIndex && <Kbd>↵</Kbd>}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {presentation.demoConsoleOpen && (
        <aside aria-label="Demo console" className="demo-console">
          <header className="demo-console__header">
            <div>
              <span className="eyebrow">Deterministic controls</span>
              <strong>Demo console</strong>
            </div>
            <button
              aria-label="Close demo console"
              className="icon-button"
              onClick={() => commands.setDemoConsoleOpen(false)}
              type="button"
            >
              <Icon name="close" size={13} />
            </button>
          </header>
          <div className="demo-console__body">
            <div className="demo-console__group">
              <span className="demo-console__label">Observation</span>
              <div className="demo-console__grid">
                <Button
                  compact
                  disabled={busyControl !== null}
                  onClick={() =>
                    void runControl("obs1", director.runObservationOneInstantly)
                  }
                  variant="secondary"
                >
                  Observation 1
                </Button>
                <Button
                  compact
                  disabled={busyControl !== null}
                  onClick={() =>
                    void runControl("obs2", director.runObservationTwoInstantly)
                  }
                  variant="secondary"
                >
                  Observation 2 + variation
                </Button>
                <Button
                  compact
                  onClick={director.inspectPattern}
                  variant="ghost"
                >
                  Inspect pattern
                </Button>
                <Button
                  compact
                  onClick={director.activatePattern}
                  variant="primary"
                >
                  Activate pattern
                </Button>
              </div>
            </div>
            <div className="demo-console__group">
              <span className="demo-console__label">Preview Run</span>
              <div className="demo-console__grid">
                <Button
                  compact
                  disabled={busyControl !== null}
                  onClick={() =>
                    void runControl("billing", director.deliverBillingReport)
                  }
                  variant="violet"
                >
                  Deliver billing
                </Button>
                <Button
                  compact
                  onClick={director.openPreviewRun}
                  variant="ghost"
                >
                  Preview Run
                </Button>
                <Button
                  compact
                  disabled={busyControl !== null}
                  onClick={() =>
                    void runControl("execute", director.approveAndExecute)
                  }
                  variant="violet"
                >
                  Approve & execute
                </Button>
                <Button
                  compact
                  disabled={busyControl !== null}
                  onClick={() =>
                    void runControl(
                      "ambiguous",
                      director.deliverAmbiguousReport,
                    )
                  }
                  variant="secondary"
                >
                  Deliver ambiguous
                </Button>
                <Button
                  compact
                  onClick={() => director.resolveAmbiguousOwner()}
                  variant="secondary"
                >
                  Resolve owner
                </Button>
                <Button
                  compact
                  disabled={busyControl !== null}
                  onClick={() =>
                    void runControl("retry", director.retryFailedRun)
                  }
                  variant="danger"
                >
                  Retry failed run
                </Button>
              </div>
            </div>
            <div className="demo-console__group">
              <label className="form-field">
                <span className="demo-console__label">Failure injection</span>
                <select
                  className="select"
                  onChange={(event) =>
                    director.selectFailurePoint(
                      (event.target.value || null) as DemoFailurePoint | null,
                    )
                  }
                  value={integration.selectedFailurePoint ?? ""}
                >
                  <option value="">No failure</option>
                  {DEMO_FAILURE_POINTS.map((point) => (
                    <option key={point} value={point}>
                      {point.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="demo-console__group">
              <span className="demo-console__label">
                Presentation & privacy
              </span>
              <div className="demo-console__grid">
                <Button compact onClick={director.toggleSound} variant="ghost">
                  Toggle sound
                </Button>
                <Button
                  compact
                  onClick={director.toggleGuideAffordances}
                  variant="ghost"
                >
                  Toggle guides
                </Button>
                <Button
                  compact
                  onClick={director.toggleObservationPause}
                  variant="ghost"
                >
                  Pause / resume
                </Button>
                <Button compact onClick={director.reset} variant="danger">
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
