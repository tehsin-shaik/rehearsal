"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Mail, Inbox, Search, MoreHorizontal, ArrowRight, Plus, Hash, Paperclip, Send, ShieldCheck, Eye, GitBranch, Ghost, Check, ArrowUpRight, Sparkles, GripHorizontal, CircleDot, Circle, Play, Layers } from "lucide-react";
import { session, useRehearsal } from "../../store/index.ts";
import { MANUAL_STEPS } from "../../application/commands/session.ts";
import { understandReport } from "../../domain/understanding/classifier.ts";
import { routeDepartment } from "../../domain/understanding/routing.ts";
import { Avatar, Badge, Empty } from "../primitives/index.tsx";
import { perform } from "../shell/shell.tsx";
import { MemoryMap } from "../memory-map/memory-map.tsx";
import { Timeline } from "../timeline/timeline.tsx";
import { GhostRun } from "../ghost-run/ghost-run.tsx";
export function Workspace() {
    const s = useRehearsal();
    const lastPhase = useRef(s.phase);
    useEffect(() => {
        if (s.sound && s.phase === "completed" && lastPhase.current !== "completed") {
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.connect(gain);
            gain.connect(context.destination);
            gain.gain.setValueAtTime(.04, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .3);
            oscillator.frequency.value = 660;
            oscillator.start();
            oscillator.stop(context.currentTime + .3);
            oscillator.onended = () => {
                void context.close();
            };
        }
        lastPhase.current = s.phase;
    }, [s.phase, s.sound]);
    const activeIndex = s.phase === "idle" || s.phase === "observing" ? 0 : s.phase === "comparing" || s.phase === "pattern_discovered" ? 1 : s.phase === "agent_ready" ? 2 : s.phase === "completed" ? 4 : 3;
    return <div className="workspace-page"><div className="page-heading"><div><span className="eyebrow">YOUR WORK, UNDERSTOOD</span><h1>Let good work repeat<span className="accent-text">.</span></h1><p>Teach a workflow once or twice. Rehearse the next run together.</p></div><div className="heading-actions"><Badge><span className="demo-dot"/>Offline demo</Badge><Link href="/onboarding" className="button secondary small">Quick tour <ArrowUpRight size={14}/></Link></div></div>
    {s.guide && <div className="phase-rail" aria-label="Workflow progress">{[{ icon: Eye, name: "Observe", sub: `${s.traces.length}/2 examples` }, { icon: GitBranch, name: "Learn", sub: s.pattern ? "Pattern discovered" : "Find the pattern" }, { icon: Layers, name: "Prepare", sub: "Activate workflow" }, { icon: Ghost, name: "Rehearse", sub: "Review & approve" }, { icon: Check, name: "Automate", sub: "Verify every action" }].map((p, i) => <div className={`phase ${i === activeIndex ? "current" : ""} ${i < activeIndex ? "done" : ""}`} key={p.name}><span className="phase-icon">{i < activeIndex ? <Check size={16}/> : <p.icon size={17}/>}</span><div><strong>{p.name}</strong><small>{p.sub}</small></div>{i < 4 && <span className="phase-connector"/>}</div>)}</div>}
    <ActionPanel />
    <div className="work-surfaces" style={{ minHeight: s.panelHeight, height: s.panelHeight }}><MailSurface /><TrackerSurface /><ChatSurface /></div>
    <div className="resize-row"><label aria-label="Resize work surfaces"><GripHorizontal size={17}/><input aria-label="Workspace panel height" type="range" min={260} max={520} value={s.panelHeight} onChange={e => {
            const height = Number(e.target.value);
            session.update({ panelHeight: height });
            try {
                localStorage.setItem("rehearsal-panel-height", String(height));
            }
            catch { /* Optional preference. */
            }
        }}/></label></div>
    <div className="inspection-grid"><section className="panel memory-panel"><header className="panel-title"><div><GitBranch size={16}/><strong>Workflow memory</strong><Badge tone="accent">{s.pattern ? `${s.pattern.variables.length} variables` : "Building"}</Badge></div><Link href="/workflows" aria-label="Inspect workflow memory"><ArrowUpRight size={16}/></Link></header><MemoryMap /></section><section className="panel timeline-panel"><header className="panel-title"><div><CircleDot size={16}/><strong>Live activity</strong><span className="tiny-live"/></div><Link href="/activity">View all <ArrowUpRight size={13}/></Link></header><Timeline /></section></div>
    <footer className="workspace-footer"><span><ShieldCheck size={14}/>You stay in control. Every external action needs your approval.</span><span>{s.activeTrace?.events.length ?? s.traces.reduce((n, t) => n + t.events.length, 0)} semantic events<span className="footer-dot">·</span>{s.pattern ? "1 learned workflow" : "Learning from your work"}</span></footer><GhostRun />
  </div>;
}
function ActionPanel() {
    const s = useRehearsal();
    let title = "Show Rehearsal how you work.";
    let text = "Triage two support reports to teach your first workflow.";
    let label = "Start first observation";
    let action = () => session.startObservation();
    let icon = <Eye size={19}/>;
    if (s.manualStep >= 0) {
        title = `Observation ${s.traces.length + 1} · ${MANUAL_STEPS[s.manualStep]}`;
        text = s.traces.length ? `Matching the first example · ${Math.round(s.liveConfidence * 100)}% live confidence` : "Your semantic actions are recorded as you work through each surface.";
        label = MANUAL_STEPS[s.manualStep];
        action = () => session.manualNext();
    }
    else if (s.traces.length === 1 && !s.pattern) {
        title = "A good start. Let’s see it again.";
        text = "One example isn’t enough to call it a pattern. Try the API timeout report.";
        label = "Teach second example";
    }
    if (s.phase === "pattern_discovered") {
        title = "Same workflow. Different report.";
        text = `${s.pattern?.evidence.sampleSize} observations matched. Customer, department, and owner remain variables.`;
        label = "Activate learned workflow";
        action = () => session.activate();
        icon = <Sparkles size={20}/>;
    }
    if (s.phase === "agent_ready") {
        title = "Your workflow is ready for its next report.";
        text = "Deliver an unseen billing report to see how the workflow adapts.";
        label = "Deliver new report";
        action = () => session.deliver();
        icon = <Mail size={20}/>;
    }
    if (["ghost_run", "needs_review", "executing", "failed"].includes(s.phase)) {
        title = s.phase === "needs_review" ? "This report needs your judgment." : s.phase === "failed" ? "Execution paused. Completed work is safe." : s.phase === "executing" ? "Executing your approved plan." : "A new report. A carefully rehearsed plan.";
        text = s.phase === "ghost_run" ? "Billing → Awaiz. Inspect the adapted workflow before approving any action." : s.phase === "failed" ? "Inspect the failed step and retry without duplicating successful actions." : "Open the Ghost Run for the resolved actions, evidence, and current status.";
        label = s.phase === "needs_review" ? "Resolve & review" : "Inspect Ghost Run";
        action = () => session.update({ ghostOpen: true });
        icon = <Ghost size={20}/>;
    }
    if (s.phase === "completed") {
        title = "Done, and verified. That’s a good rehearsal.";
        text = `1 issue · 1 team notification · 1 customer reply. Estimated ${Math.round((s.run?.metrics.estimatedSecondsSaved ?? 0) / 60)} minutes saved.`;
        label = "Try an ambiguous report";
        action = () => session.deliver(true);
        icon = <Check size={20}/>;
    }
    if (s.phase === "cancelled") {
        title = "Run cancelled. You’re in control.";
        text = "You can try the ambiguous report or reset the demo from Demo controls.";
        label = "Try ambiguous report";
        action = () => session.deliver(true);
    }
    return <section className={`action-panel ${s.phase === "completed" ? "complete" : ""}`} aria-live="polite"><span className="action-panel-icon">{icon}</span><div><strong>{title}</strong><p>{text}</p></div><button className="button small" disabled={s.paused && (!s.pattern || s.manualStep >= 0) || s.phase === "executing"} onClick={() => perform(action)}>{label}<ArrowRight size={15}/></button></section>;
}
function MailSurface() {
    const s = useRehearsal();
    const report = s.reports.find(r => r.id === s.selectedReportId);
    const u = report ? understandReport(report) : null;
    const reply = s.replies.find(r => r.reportId === report?.id);
    const current = s.manualStep === 0 || s.manualStep === 1 || s.manualStep === 9 || s.manualStep === 10;
    return <section className={`panel surface mail-surface ${current ? "surface-active" : ""}`} aria-label="Mail replica"><header className="surface-header"><span className="app-icon mail-icon"><Mail size={17}/></span><strong>Mail</strong><Badge>Replica</Badge><button className="icon-button" aria-label="Select first report" onClick={() => report && session.selectReport(s.reports[0].id)}><MoreHorizontal size={17}/></button></header><div className="mail-toolbar"><span><Inbox size={14}/>Inbox <b>{s.reports.length}</b></span><Search size={15}/></div><div className="mail-content"><div className="mail-list">{s.reports.map(r => <button key={r.id} className={`mail-item ${r.id === s.selectedReportId ? "selected" : ""}`} disabled={s.manualStep >= 0 && r.id !== s.selectedReportId} onClick={() => session.selectReport(r.id)}><span className="mail-row"><strong>{r.senderName ?? r.body.match(/Customer: (.+)/)?.[1] ?? "Customer"}</strong><small>{r.id.startsWith("noise") ? "Yesterday" : "Today"}</small></span><span>{r.subject}</span>{reply?.reportId === r.id && <small className="success-text">Replied ✓</small>}</button>)}</div>{report && <article className="email-preview"><div className="email-sender"><Avatar name={u?.customer.name ?? report.senderName ?? "Customer"} small/><div><strong>{u?.customer.name ?? report.senderName}</strong><small>{u?.customer.email ?? report.senderEmail}</small></div><Badge>{reply ? "Replied" : "To support"}</Badge></div><h3>{report.subject}</h3><p>{report.body.split("\n").filter(line => !line.startsWith("Customer:") && !line.startsWith("Email:")).join("\n\n")}</p>{s.manualStep >= 9 && s.manualStep <= 10 && <div className="local-draft"><small>LOCAL REPLY DRAFT</small><p>Hi {u?.customer.name}, thanks for reporting this. {u?.owner} will review your issue and follow up.</p></div>}{reply && <div className="sent-confirmation"><Check size={14}/>Reply sent in demo</div>}</article>}</div>{current && <SurfaceAction label={MANUAL_STEPS[s.manualStep]}/>}</section>;
}
function TrackerSurface() {
    const s = useRehearsal();
    const report = s.reports.find(r => r.id === s.selectedReportId);
    const u = report ? understandReport(report) : null;
    const drafting = s.manualStep >= 2 && s.manualStep <= 5;
    return <section className={`panel surface ${drafting ? "surface-active" : ""}`} aria-label="Issue tracker replica"><header className="surface-header"><span className="app-icon tracker-icon"><Layers size={17}/></span><strong>Issue tracker</strong><Badge>Replica</Badge><span className="surface-spacer"/><Plus size={17}/></header><div className="tracker-toolbar"><strong>Support triage</strong><span>{s.issues.length} issues</span><Badge>All issues</Badge></div><div className="tracker-body">{drafting && u && <div className="issue-composer"><span className="section-label">NEW ISSUE · LOCAL DRAFT</span><h3>{u.issue.title}</h3><p>{u.issue.description.split("\n").slice(2).join(" ")}</p>{s.manualStep >= 3 && <div className="tag-row"><Badge tone="warning">{u.issue.severity} priority</Badge>{u.issue.labels.map(l => <Badge key={l}>{l}</Badge>)}</div>}{s.manualStep >= 4 && <div className="assignee"><Avatar name={u.owner!} small/><span>Assigned to <strong>{u.owner}</strong></span></div>}</div>}<div className="issue-group"><CircleDot size={13}/><strong>Open</strong><span>{s.issues.length}</span></div>{s.issues.map((issue, i) => <div className={`issue-card ${i === 0 && s.issues.length > 2 ? "fresh" : ""}`} key={issue.id}><div className="issue-meta"><span>{issue.id}</span><span className={`priority-bars ${issue.severity}`}>▂▄▆</span></div><strong>{issue.title}</strong><div className="issue-bottom"><div className="tag-row">{issue.labels.slice(0, 2).map(l => <Badge key={l}>{l.replaceAll("_", " ")}</Badge>)}</div><span title={issue.owner ?? "Unassigned"}>{issue.owner ? <Avatar name={issue.owner} small/> : <Circle size={20}/>}</span></div></div>)}</div>{drafting && <SurfaceAction label={MANUAL_STEPS[s.manualStep]}/>}</section>;
}
function ChatSurface() {
    const s = useRehearsal();
    const drafting = s.manualStep >= 6 && s.manualStep <= 8;
    const report = s.reports.find(r => r.id === s.selectedReportId);
    const u = report ? understandReport(report) : null;
    return <section className={`panel surface ${drafting ? "surface-active" : ""}`} aria-label="Team chat replica"><header className="surface-header"><span className="app-icon chat-icon"><Hash size={18}/></span><strong>Team chat</strong><Badge>Replica</Badge><span className="surface-spacer"/><MoreHorizontal size={17}/></header><div className="channel-bar"><Hash size={15}/><select aria-label="Team channel" value={s.channel} onChange={e => session.update({ channel: e.target.value })}><option value="technical-support">technical-support</option><option value="billing-finance">billing-finance</option><option value="product-engineering">product-engineering</option><option value="sales">sales</option><option value="logistics">logistics</option><option value="legal-privacy">legal-privacy</option></select><span className="channel-avatars"><Avatar name="Umar" small/><Avatar name="Noor" small/></span></div><div className="chat-body"><div className="chat-date"><span />Today<span /></div>{s.messages.filter(m => m.channel === s.channel).map(m => <div className="chat-message" key={m.id}><Avatar name={m.author} small/><div><strong>{m.author}</strong>{m.author === "Rehearsal" && <Badge tone="accent">APP</Badge>}<time>Today</time><p>{m.text}</p>{m.issueReference && <span className="chat-reference"><Layers size={12}/>{m.issueReference}</span>}</div></div>)}{s.messages.filter(m => m.channel === s.channel).length === 0 && <Empty icon={<Hash size={20}/>} title="A quiet channel">Notifications routed here will appear after execution.</Empty>}</div><div className={`chat-composer ${s.manualStep === 7 || s.manualStep === 8 ? "draft-ready" : ""}`}><p>{s.manualStep >= 7 && s.manualStep <= 8 ? `${u?.customer.name}: ${u?.issue.title}. Assigned to ${routeDepartment(u?.issue.department ?? "unresolved")?.owner}.` : `Message #${s.channel}`}</p><div><span><Plus size={14}/><Paperclip size={14}/><b>Aa</b></span><Send size={14}/></div></div>{drafting && <SurfaceAction label={MANUAL_STEPS[s.manualStep]}/>}</section>;
}
function SurfaceAction({ label }: {
    label: string;
}) {
    return <button className="surface-action" onClick={() => perform(() => session.manualNext())}><Play size={13}/>{label}<ArrowRight size={14}/></button>;
}
