"use client";

import type { CSSProperties } from "react";

import { useRehearsalState } from "@/components/providers/rehearsal-provider";
import { ChatReplica } from "@/components/workspace/chat-replica";
import { InspectionPanels } from "@/components/workspace/inspection-panels";
import { MailReplica } from "@/components/workspace/mail-replica";
import { PhasePanel } from "@/components/workspace/phase-panel";
import { StatusDock } from "@/components/workspace/status-dock";
import { TrackerReplica } from "@/components/workspace/tracker-replica";
import { WorkflowRail } from "@/components/workspace/workflow-rail";
import { WorkspaceOverlays } from "@/components/workspace/workspace-overlays";
import { WorkspaceTopbar } from "@/components/workspace/workspace-topbar";
import { cx } from "@/components/ui/primitives";

export default function WorkspacePage() {
  const phase = useRehearsalState((state) => state.engine.phase);
  const layout = useRehearsalState((state) => state.presentation.layout);
  const agentFocused = [
    "trigger_detected",
    "planning",
    "preview_ready",
    "needs_review",
    "executing",
    "completed",
    "failed",
  ].includes(phase);
  const style = {
    "--replica-height": `${layout.replicaRowHeight}px`,
    "--inspection-height": `${layout.inspectionRowHeight}px`,
  } as CSSProperties;

  return (
    <main
      className={cx("workspace-page", agentFocused && "is-agent-focused")}
      style={style}
    >
      <WorkspaceTopbar />
      <WorkflowRail />
      <div className="workspace-main">
        <section aria-label="Replica applications" className="replica-grid">
          <MailReplica />
          <TrackerReplica />
          <ChatReplica />
        </section>
        <section aria-label="Current Rehearsal phase" className="central-panel">
          <PhasePanel />
        </section>
        <InspectionPanels />
        <StatusDock />
      </div>
      <WorkspaceOverlays />
    </main>
  );
}
