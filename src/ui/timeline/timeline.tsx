"use client";
import { Check, Eye, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
import { useRehearsal } from "../../store/index.ts";
export function Timeline({ full = false }: {
    full?: boolean;
}) {
    const s = useRehearsal();
    const entries = [...s.timeline].reverse().slice(0, full ? 500 : 4);
    if (!entries.length)
        return <div className="timeline-empty"><span className="timeline-pulse"/><div><strong>Your work tells the story.</strong><p>Start an observation to see semantic actions and decisions appear here.</p></div></div>;
    return <ol className={`timeline ${full ? "full" : ""}`}>{entries.map(e => { const Icon = e.kind === "observed" ? Eye : e.kind === "executed" ? Check : e.kind === "approval" ? ShieldCheck : e.kind === "failure" ? AlertTriangle : Sparkles; return <li key={e.id}><span className={`timeline-icon ${e.kind}`}><Icon size={13}/></span><div><strong>{e.title}</strong>{full && <p>{e.detail}</p>}<small>{e.kind} {full && `· ${new Date(e.timestamp).toLocaleTimeString()}`}</small></div>{!full && <time>{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}</li>; })}</ol>;
}
