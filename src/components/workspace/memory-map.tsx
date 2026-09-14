"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import type { ApplicationWorkflow } from "../../application/store/types";
import type { PreviewRun } from "../../domain/runs/preview-run-types";
import { Icon, type IconName } from "../ui/icon";
import { cx } from "../ui/primitives";

const STAGES: readonly { readonly label: string; readonly icon: IconName }[] = [
  { label: "Report", icon: "mail" },
  { label: "Understand", icon: "search" },
  { label: "Ticket", icon: "ticket" },
  { label: "Owner", icon: "users" },
  { label: "Notify", icon: "send" },
  { label: "Approval", icon: "shield" },
];

function flowState(run: PreviewRun | null): "idle" | "preview" | "complete" {
  if (run?.status === "completed") return "complete";
  if (run !== null) return "preview";
  return "idle";
}

export function CompactMemoryMap({ run }: { readonly run: PreviewRun | null }) {
  const state = flowState(run);
  return (
    <div className="memory-compact" aria-label="Compact workflow memory map">
      {STAGES.map((stage, index) => (
        <div style={{ display: "contents" }} key={stage.label}>
          <div
            className={cx(
              "memory-node",
              state === "preview" && "is-preview",
              state === "complete" && "is-complete",
            )}
          >
            <span className="memory-node__icon">
              <Icon name={stage.icon} size={13} />
            </span>
            <span>{stage.label}</span>
          </div>
          {index < STAGES.length - 1 && (
            <span
              className={cx(
                "memory-edge",
                state === "preview" && "is-active",
                state === "complete" && "is-complete",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function MemoryMap({
  workflow,
  run,
}: {
  readonly workflow: ApplicationWorkflow | null;
  readonly run: PreviewRun | null;
}) {
  const flow = useMemo(() => {
    const state = flowState(run);
    const nodes: Node[] = STAGES.map((stage, index) => ({
      id: `stage-${index}`,
      position: { x: index * 165, y: index % 2 === 0 ? 112 : 164 },
      data: { label: stage.label },
      className:
        stage.label === "Approval"
          ? "memory-node--approval"
          : state === "preview"
            ? "memory-node--preview"
            : "",
      draggable: false,
      selectable: false,
    }));
    const variableCount = workflow?.pattern.variables.length ?? 0;
    const constantCount = workflow?.pattern.constants.length ?? 0;
    nodes.push(
      {
        id: "variables",
        position: { x: 315, y: 20 },
        data: { label: `${variableCount || 9} variables` },
        className: "memory-node--preview",
        draggable: false,
        selectable: false,
      },
      {
        id: "routing",
        position: { x: 490, y: 272 },
        data: { label: "department → owner" },
        draggable: false,
        selectable: false,
      },
      {
        id: "constants",
        position: { x: 660, y: 20 },
        data: { label: `${constantCount || 1} constant` },
        draggable: false,
        selectable: false,
      },
    );
    const edgeColor =
      state === "complete"
        ? "#2dd4a7"
        : state === "preview"
          ? "#8b7cff"
          : "rgba(255,255,255,.16)";
    const edges: Edge[] = STAGES.slice(0, -1).map((_, index) => ({
      id: `edge-${index}`,
      source: `stage-${index}`,
      target: `stage-${index + 1}`,
      animated: state === "preview",
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      style: { stroke: edgeColor, strokeWidth: 1.2 },
    }));
    edges.push(
      {
        id: "edge-variables",
        source: "variables",
        target: "stage-2",
        style: { stroke: "rgba(56,220,255,.35)" },
      },
      {
        id: "edge-routing",
        source: "stage-3",
        target: "routing",
        style: { stroke: "rgba(56,220,255,.35)" },
      },
      {
        id: "edge-constants",
        source: "constants",
        target: "stage-4",
        style: { stroke: "rgba(56,220,255,.35)" },
      },
    );
    return { nodes, edges };
  }, [run, workflow]);

  return (
    <div className="react-flow-wrapper" aria-label="Workflow memory map">
      <ReactFlow
        attributionPosition="bottom-right"
        edges={flow.edges}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        maxZoom={1.25}
        minZoom={0.45}
        nodes={flow.nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnDrag={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        zoomOnDoubleClick={false}
        zoomOnPinch={false}
        zoomOnScroll={false}
      >
        <Background
          color="rgba(255,255,255,.045)"
          gap={28}
          size={1}
          variant={BackgroundVariant.Dots}
        />
      </ReactFlow>
    </div>
  );
}
