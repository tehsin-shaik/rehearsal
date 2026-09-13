"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Mail, ShieldCheck, RefreshCw, ArrowRight, Check } from "lucide-react";
import { TEAM_ROUTES, type ResolvedDepartment } from "@/domain/understanding/routing";
import type { Report } from "@/domain/understanding/classifier";
import { isSupportReport } from "@/domain/understanding/classifier";
import type { AgentRun } from "@/domain/runs/agent-run";
import type { SemanticEvent } from "@/domain/events/semantic-event";
import { localApi, executeRemotePlan } from "@/infrastructure/adapters/remote";
import { Badge, Modal } from "@/ui/primitives";
export function LiveWorkspace() {
    const [reports, setReports] = useState<Report[]>([]);
    const [events, setEvents] = useState<SemanticEvent[]>([]);
    const [run, setRun] = useState<AgentRun | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [inspect, setInspect] = useState(false);
    const [department, setDepartment] = useState<ResolvedDepartment>("billing");
    const cursor = useRef(0);
    const loaded = useRef(false);
    const execution = useRef(false);
    async function refresh() { try {
        const [mail, observed] = await Promise.all([localApi<{
                reports: Report[];
            }>("/api/surfaces/mail"), localApi<{
                events: {
                    sequence: number;
                    event: SemanticEvent;
                }[];
                cursor: number;
            }>(`/api/observe?after=${cursor.current}`)]);
        setReports(mail.reports);
        setEvents(old => { const seen = new Set(old.map(e => e.id)); return [...old, ...observed.events.map(e => e.event).filter(e => !seen.has(e.id))].slice(-1000); });
        cursor.current = observed.cursor;
        setError("");
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
    } }
    useEffect(() => { if (!loaded.current) {
        loaded.current = true;
        queueMicrotask(() => { void refresh(); });
    } const timer = setInterval(() => { void refresh(); }, 30000); return () => clearInterval(timer); }, []);
    const groups = Object.groupBy(events, e => e.traceId);
    const traces = Object.entries(groups).filter(([, e]) => e?.some(event => event.payload.finished)).map(([id, e]) => ({ id, startedAt: e![0].occurredAt, completedAt: e!.at(-1)!.occurredAt, events: e!.filter(event => !event.payload.finished).map(({ traceId, occurredAt, sourceApplication, action, payload }) => ({ traceId, occurredAt, sourceApplication, action, payload })) }));
    async function plan(report: Report) { setBusy(true); setError(""); try {
        setRun(await localApi<AgentRun>("/api/runs", { report, traces }));
        setInspect(true);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Planning failed");
    }
    finally {
        setBusy(false);
    } }
    async function execute() { if (!run || execution.current)
        return; execution.current = true; setBusy(true); try {
        setRun(await executeRemotePlan(run, setRun));
        await refresh();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Execution failed");
    }
    finally {
        execution.current = false;
        setBusy(false);
    } }
    return <div className="content-page"><div className="page-heading"><div><span className="eyebrow">CONNECTED TO REAL ACCOUNTS</span><h1>Live workspace<span className="accent-text">.</span></h1><p>Inspect real reports and rehearse approved actions against your configured tools.</p></div><Badge tone="warning">Live destinations</Badge></div>{error && <div role="alert" className="review-card"><strong>{error}</strong><p><Link href="/integrations">Review integration setup<ArrowRight size={13}/></Link></p></div>}<div className="detail-columns"><section className="panel padded"><div className="section-heading"><h2><Mail size={18}/>Recent mail</h2><button className="button secondary small" onClick={() => { void refresh(); }}><RefreshCw size={13}/>Refresh</button></div>{reports.map(report => <article className="live-report" key={report.id}><strong>{report.subject}</strong><p>{report.senderName} · {report.senderEmail}</p><details><summary>Inspect report</summary><p>{report.body}</p></details>{isSupportReport(report) ? <button className="button small" disabled={busy || traces.length < 2} onClick={() => { void plan(report); }}>Prepare Ghost Run</button> : <Badge>Not a support trigger</Badge>}</article>)}{!reports.length && <p>Connect Gmail and authorize inbox access to load recent reports.</p>}</section><section className="panel padded"><h2><Eye size={18}/>Observed work</h2><p>{traces.length} finished observations · {events.length} semantic events</p><p>The extension records supported Gmail, Jira, and ClickUp interactions. Finish each observation in its popup. Two complete traces including create, assign, team notification, and reply are needed for this support workflow.</p><p>DOM observations are conservative and may not capture every stage; incomplete traces cannot activate a workflow.</p>{events.slice(-12).reverse().map(e => <div className="live-event" key={e.id}><strong>{e.intent}</strong><small>{e.sourceApplication} · {e.traceId}</small></div>)}</section></div>{run && <section className="panel padded"><h2>Latest run</h2><p>{run.understanding.issue.title} · {run.status.replaceAll("_", " ")}</p><button className="button" onClick={() => setInspect(true)}>Inspect plan</button></section>}{inspect && run && <Modal title="Live Ghost Run" className="ghost-dialog" onClose={() => setInspect(false)}><Badge tone="warning">These are real destinations</Badge><h2 className="live-run-title">{run.understanding.issue.title}</h2><p>Department: {run.understanding.issue.department} · Owner: {run.understanding.owner ?? "Needs review"}</p><p>Confidence: {Math.round(run.understanding.confidence.overall * 100)}% · {run.understanding.provenance?.provider}</p>{run.understanding.evidence.map((e, i) => <blockquote key={i}>{e.excerpt}</blockquote>)}{run.plannedActions.map(a => <details key={a.id} className="ghost-action"><summary><span className="action-number">{a.status === "completed" ? <Check size={14}/> : a.sequence}</span><div><strong>{a.action.replaceAll("_", " ")}</strong><small>{a.destination}</small></div><Badge>{a.status}</Badge></summary><div className="action-detail"><p>Permission: {a.permission} · Risk: {a.risk}</p><pre>{JSON.stringify(a.resolvedInput, null, 2)}</pre>{run.results.find(r => r.actionId === a.id)?.error && <p className="error-text">{run.results.find(r => r.actionId === a.id)?.error?.message}</p>}</div></details>)}<div className="ghost-footer"><p><ShieldCheck size={16}/>Only this server-owned plan is covered by your approval.</p><div>{run.status === "needs_review" ? <div><p>Select the department using your judgment, then review the revised plan.</p><select aria-label="Resolve live department" value={department} onChange={e => setDepartment(e.target.value as ResolvedDepartment)}>{Object.entries(TEAM_ROUTES).map(([key, r]) => <option key={key} value={key}>{r.label} · {r.owner}</option>)}</select><button className="button" disabled={busy} onClick={() => { setBusy(true); void localApi<AgentRun>(`/api/runs/${run.id}`, { intent: "resolve", department }).then(setRun).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>Resolve & review revised plan</button></div> : run.status === "completed" ? <Badge tone="success">All actions verified</Badge> : <button className="button" disabled={busy || run.status === "cancelled" || run.results.some(r => r.status === "failed" && !r.error?.retryable)} onClick={() => { void execute(); }}>{busy ? "Executing…" : run.status === "failed" ? "Retry incomplete actions" : "Approve & execute live plan"}</button>}</div></div></Modal>}</div>;
}
