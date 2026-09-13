"use client";
import { useState } from "react";
import { Ghost, ShieldCheck, ArrowRight, Check, AlertTriangle, ChevronDown, ExternalLink, LoaderCircle } from "lucide-react";
import { session, useRehearsal } from "../../store/index.ts";
import { Badge, Modal, Avatar } from "../primitives/index.tsx";
import { perform } from "../shell/shell.tsx";
import { TEAM_ROUTES, routeDepartment, type ResolvedDepartment } from "../../domain/understanding/routing.ts";
export function GhostRun() {
    const s = useRehearsal();
    const run = s.run;
    const [department, setDepartment] = useState<ResolvedDepartment>("technical_support");
    if (!run || !s.ghostOpen)
        return null;
    const u = run.understanding;
    const route = routeDepartment(u.issue.department);
    const busy = run.status === "executing";
    return <Modal title="Ghost Run" className="ghost-dialog" onClose={() => session.update({ ghostOpen: false })}>
    <div className="ghost-intro"><span className="ghost-symbol"><Ghost size={28}/></span><div><Badge tone={run.status === "completed" ? "success" : run.status === "needs_review" || run.status === "failed" ? "warning" : "accent"}>{run.status.replaceAll("_", " ")}</Badge><h3>See the work before it happens.</h3><p>Every action, value, and destination. Your approval is the final step.</p></div></div>
    <section className="ghost-section"><div className="section-label">01 / THE TRIGGER</div><div className="trigger-card"><Avatar name={u.customer.name ?? "Customer"}/><div><strong>{u.issue.title}</strong><p>{u.customer.name} <span className="muted">· {u.customer.email}</span></p></div></div></section>
    <section className="ghost-section"><div className="section-label">02 / WHAT WAS UNDERSTOOD</div><div className="understanding-grid"><div><small>Department</small><strong>{route?.label ?? "Needs review"}</strong></div><div><small>Owner</small><strong>{u.owner ?? "Not assigned"}</strong></div><div><small>Category</small><strong>{u.issue.category.replaceAll("_", " ")}</strong></div><div><small>Confidence</small><strong>{Math.round(u.confidence.overall * 100)}%</strong></div></div>{u.evidence.map((e, i) => <blockquote key={i}>“{e.excerpt}”<cite>Literal evidence from the report</cite></blockquote>)}<p className="provenance">{u.provenance?.provider} · {u.provenance?.model} · {u.provenance?.validated ? "validated" : "unvalidated"} · {u.provenance?.latencyMs} ms{u.provenance?.fallbackReason && ` · fallback: ${u.provenance.fallbackReason}`}</p></section>
    {run.adaptations.length > 0 && <section className="adaptation-card"><div><GitBranchIcon /><strong>Adapted, not replayed</strong></div>{run.adaptations.map(a => <p key={a.field}><span>{String(a.from).replaceAll("_", " ")}</span><ArrowRight size={13}/><strong>{String(a.to).replaceAll("_", " ")}</strong><small>{a.rule}</small></p>)}</section>}
    {run.status === "needs_review" && <div className="review-card"><AlertTriangle size={20}/><h3>This report needs your judgment.</h3><p>There isn’t enough evidence to route it safely. Choose a department to prepare a revised plan. Approval will still be required.</p><label className="field-label">Correct department<select value={department} onChange={e => setDepartment(e.target.value as ResolvedDepartment)}>{Object.entries(TEAM_ROUTES).map(([key, r]) => <option key={key} value={key}>{r.label} · {r.owner}</option>)}</select></label><button className="button" onClick={() => perform(() => session.resolveReview(department))}>Resolve & review new plan</button></div>}
    <section className="ghost-section"><div className="section-label">03 / THE PROPOSED ACTIONS</div><div className="ghost-actions">{run.plannedActions.map(a => {
        const result = run.results.find(r => r.actionId === a.id);
        return <details key={a.id} className={`ghost-action ${a.status}`} open={a.status === "failed"}><summary><span className="action-number">{a.status === "completed" ? <Check size={15}/> : a.status === "executing" ? <LoaderCircle size={15} className="spin"/> : a.sequence}</span><div><strong>{a.action.replaceAll("_", " ")}</strong><small>{a.destination}</small></div><Badge tone={a.status === "completed" ? "success" : a.status === "failed" ? "danger" : "neutral"}>{a.status === "planned" ? a.requiresApproval ? "Approval" : "Read only" : a.status.replaceAll("_", " ")}</Badge><ChevronDown size={14}/></summary><div className="action-detail"><p><strong>Permission:</strong> {a.permission} · <strong>Risk:</strong> {a.risk}</p>{Object.entries(a.resolvedInput).map(([key, value]) => <div className="parameter" key={key}><small>{key}</small><pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></div>)}{result && <p className={result.status === "failed" ? "error-text" : "success-text"}>{result.status === "succeeded" ? `Verified by ${result.adapter}${result.externalReference ? ` · ${result.externalReference}` : ""}` : result.error?.message}</p>}{result?.externalUrl && <a href={result.externalUrl} target="_blank" rel="noreferrer">Open confirmed result <ExternalLink size={12}/></a>}</div></details>;
    })}</div></section>
    {!!u.research?.length && <section className="ghost-section"><div className="section-label">PUBLIC REFERENCES</div>{u.research.map(r => <a className="research-link" key={r.url} href={r.url} target="_blank" rel="noreferrer">{r.title}<ExternalLink size={13}/></a>)}<p className="muted">Sanitized query: {u.researchQuery}</p></section>}
    <div className="ghost-footer"><p><ShieldCheck size={15}/>{s.mode === "demo" ? "Demo destinations only. No real messages are sent." : "Approval applies to the displayed live destinations."}</p><div>{["ghost_run", "needs_review", "failed"].includes(run.status) && <button className="button secondary" onClick={() => perform(() => session.cancel())}>Cancel run</button>}{run.status === "ghost_run" && <button className="button" onClick={() => perform(() => session.execute())}><ShieldCheck size={17}/>Approve & execute</button>}{run.status === "failed" && <button className="button" onClick={() => perform(() => session.execute(true))}>Retry incomplete actions <ArrowRight size={16}/></button>}{busy && <button className="button" disabled><LoaderCircle size={17} className="spin"/>Executing approved plan…</button>}{run.status === "completed" && <span className="success-confirmation"><Check size={18}/>All 5 actions verified</span>}</div></div>
  </Modal>;
}
function GitBranchIcon() {
    return <span className="adapt-icon">↳</span>;
}
