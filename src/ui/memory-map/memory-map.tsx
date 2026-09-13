"use client";
import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType, Position, type Node, type Edge } from "@xyflow/react";
import { Mail, ScanText, GitBranch, ShieldCheck, Send } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useRehearsal } from "../../store/index.ts";
const stages = [
    { id: "trigger", icon: Mail, label: "New report", sub: "mail · trigger", detail: "Only unread support reports can trigger an active workflow." },
    { id: "understand", icon: ScanText, label: "Understand", sub: "extract + classify", detail: "Literal report evidence supports classification. Low confidence requires human review." },
    { id: "route", icon: GitBranch, label: "Route owner", sub: "department → owner", detail: "The owner and channel are derived from each new department. They are never memorized from the examples." },
    { id: "approval", icon: ShieldCheck, label: "Your approval", sub: "required boundary", detail: "No issue creation or sending can cross this boundary without explicit approval." },
    { id: "execute", icon: Send, label: "Act & verify", sub: "issue · chat · reply", detail: "Every adapter must confirm success. Retry resumes from the failed action." },
];
export function MemoryMap({ full = false }: {
    full?: boolean;
}) {
    const s = useRehearsal();
    const [selected, setSelected] = useState<string | null>(null);
    const [positions, setPositions] = useState<Record<string, {
        x: number;
        y: number;
    }>>({});
    const nodes = useMemo<Node[]>(() => [
        ...stages.map((stage, i) => ({ id: stage.id, position: positions[stage.id] ?? { x: i * 180, y: 0 }, sourcePosition: Position.Right, targetPosition: Position.Left, className: stage.id === "approval" ? "flow-approval" : "", data: { label: <div className="flow-node"><stage.icon size={20}/><strong>{stage.label}</strong><small>{stage.sub}</small>{s.phase === "completed" && <span className="node-check">✓</span>}</div> }, style: { width: 148 }, draggable: full })),
        { id: "variables", position: positions.variables ?? { x: 235, y: 130 }, data: { label: <div className="flow-variable">customer · category · department · owner · channel</div> }, style: { width: 420 }, draggable: full },
    ], [s.phase, full, positions]);
    const edges = useMemo<Edge[]>(() => [
        ...stages.slice(0, -1).map((stage, i) => ({ id: `edge-${stage.id}`, source: stage.id, target: stages[i + 1].id, markerEnd: { type: MarkerType.ArrowClosed, color: "#b5adc8" }, style: { stroke: "#c3bcd2", strokeWidth: 1.3 }, animated: s.phase === "executing" })),
        { id: "variables-understanding", source: "understand", target: "variables", style: { stroke: "#c9bedb", strokeDasharray: "4 4" } },
        { id: "variables-routing", source: "variables", target: "route", style: { stroke: "#c9bedb", strokeDasharray: "4 4" } },
    ], [s.phase]);
    return <div className={`memory-map react-flow-map ${full ? "full" : ""}`}><ReactFlow nodes={nodes} edges={edges} onNodesChange={changes => { const moves: Record<string, {
        x: number;
        y: number;
    }> = {}; for (const change of changes)
        if (change.type === "position" && change.position)
            moves[change.id] = change.position; if (Object.keys(moves).length)
        setPositions(old => ({ ...old, ...moves })); }} fitView fitViewOptions={{ padding: .15 }} minZoom={.3} maxZoom={1.5} zoomOnScroll={false} preventScrolling={false} nodesConnectable={false} onNodeClick={(_, node) => setSelected(node.id)} proOptions={{ hideAttribution: false }}><Background color="#ddd9e8" gap={18} size={1}/><Controls showInteractive={false}/></ReactFlow>{selected && <button className="map-tooltip" onClick={() => setSelected(null)}>{stages.find(n => n.id === selected)?.detail ?? "Extracted, classified, routed and generated fields remain variables. Explicitly authored invariant fields alone may be constants."}</button>}</div>;
}
