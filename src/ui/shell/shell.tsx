"use client";
import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LayoutDashboard, Workflow, Activity, ShieldCheck, Command, ArrowUpRight, Pause, Play, SlidersHorizontal, CircleHelp, Plug } from "lucide-react";
import { Brand, Avatar, Badge, Modal } from "../primitives/index.tsx";
import { session, useRehearsal } from "../../store/index.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
export function perform(action: () => unknown): void {
    try {
        const result = action();
        if (result instanceof Promise)
            result.catch(error => session.update({ error: error instanceof Error ? error.message : "The action could not be completed." }));
    }
    catch (error) {
        session.update({ error: error instanceof Error ? error.message : "The action could not be completed." });
    }
}
export function Shell({ children }: {
    children: ReactNode;
}) {
    const pathname = usePathname();
    const s = useRehearsal();
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (["INPUT", "TEXTAREA", "SELECT"].includes(tag))
                return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                session.update({ commandOpen: !session.getSnapshot().commandOpen });
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
                e.preventDefault();
                session.update({ demoOpen: !session.getSnapshot().demoOpen });
            }
            if (e.key.toLowerCase() === "g" && session.getSnapshot().run)
                session.update({ ghostOpen: true });
        };
        window.addEventListener("keydown", onKey);
        try {
            const height = Number(localStorage.getItem("rehearsal-panel-height"));
            if (height >= 260 && height <= 520)
                session.update({ panelHeight: height });
        }
        catch { /* Storage is optional. */ }
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    const links = [{ href: "/workspace", label: "Workspace", icon: LayoutDashboard }, { href: "/workflows", label: "Workflows", icon: Workflow }, { href: "/activity", label: "Activity", icon: Activity }, { href: "/integrations", label: "Integrations", icon: Plug }, { href: "/privacy", label: "Privacy & controls", icon: ShieldCheck }];
    return <MotionConfig reducedMotion="user"><motion.div className="app-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .2 }}>
    <aside className="sidebar"><Link href="/" className="brand-link" aria-label="Rehearsal home"><Brand /></Link><div className="workspace-switch"><span className="workspace-initial">R</span><div><strong>My workspace</strong><small>Personal workspace</small></div><span className="ellipsis">⌄</span></div><div className="nav-label">WORKSPACE</div><nav aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`}><Icon size={18}/>{label}{href === "/workflows" && s.pattern && <span className="nav-count">1</span>}</Link>)}</nav><div className="sidebar-bottom"><div className="demo-card"><span className="eyebrow">A SAFE PLACE TO LEARN</span><strong>Make yourself at home.</strong><p>Everything in this demo stays in your browser session.</p><Link href="/onboarding">How it works <ArrowUpRight size={14}/></Link></div><button className="nav-item" onClick={() => session.update({ demoOpen: true })}><SlidersHorizontal size={17}/>Demo controls <kbd>⇧ D</kbd></button><Link href="/onboarding" className="nav-item"><CircleHelp size={17}/>Quick guide</Link><div className="profile"><Avatar name="Tehsin Shaik" small/><div><strong>Your workspace</strong><small>Local reviewer</small></div><Badge tone="accent">Demo</Badge></div></div></aside>
    <div className="app-main"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{links.find(l => pathname.startsWith(l.href))?.label ?? "Overview"}</strong></div><div className="topbar-actions"><span className="status-inline"><i className={s.paused ? "paused-dot" : "live-dot"}/>{s.paused ? "Observation paused" : "Observation enabled"}</span><button className="icon-button" onClick={() => perform(() => session.setPaused(!s.paused))} aria-label={s.paused ? "Resume observation" : "Pause observation"}>{s.paused ? <Play size={15}/> : <Pause size={15}/>}</button><span className="divider"/><button className="search-trigger" onClick={() => session.update({ commandOpen: true })}><Command size={14}/><span>Commands</span><kbd>⌘ K</kbd></button></div></header><main>{children}</main></div>
    {s.error && <div role="alert" className="toast"><strong>Action needs attention</strong><p>{s.error}</p><button className="text-button" onClick={() => session.update({ error: null })}>Dismiss</button></div>}
    {s.demoOpen && <DemoConsole />}{s.commandOpen && <CommandPalette />}
  </motion.div></MotionConfig>;
}
function DemoConsole() {
    const s = useRehearsal();
    return <Modal title="Demo controls" onClose={() => session.update({ demoOpen: false })}><p className="muted">These controls use the same engine commands as the work surfaces.</p><div className="control-grid">
    <button onClick={() => perform(() => session.instantObservation())} disabled={!!s.pattern || s.manualStep >= 0}>Complete observation {s.traces.length + 1}</button>
    <button onClick={() => perform(() => session.activate())} disabled={s.phase !== "pattern_discovered"}>Activate workflow</button>
    <button onClick={() => perform(() => session.deliver())} disabled={!s.pattern || !["agent_ready", "completed", "cancelled"].includes(s.phase)}>Deliver billing report</button>
    <button onClick={() => perform(() => session.deliver(true))} disabled={!s.pattern || !["agent_ready", "completed", "cancelled"].includes(s.phase)}>Deliver ambiguous report</button>
    <button onClick={() => session.update({ ghostOpen: true, demoOpen: false })} disabled={!s.run}>Inspect Ghost Run</button>
    <button onClick={() => perform(() => session.execute(s.phase === "failed"))} disabled={!["ghost_run", "failed"].includes(s.phase)}>Approve & execute / retry</button>
  </div><label className="field-label">Inject one adapter failure<select defaultValue="" onChange={e => { if (e.target.value)
        perform(() => session.failOnce(e.target.value as PlannedAction["action"])); }}><option value="">Choose a step</option>{["create_issue", "assign_owner", "send_team_notification", "reply_to_customer"].map(a => <option key={a} value={a}>{a.replaceAll("_", " ")}</option>)}</select></label><label className="check-row"><input type="checkbox" checked={s.guide} onChange={e => session.update({ guide: e.target.checked })}/>Show guide affordances</label><label className="check-row"><input type="checkbox" checked={s.sound} onChange={e => session.update({ sound: e.target.checked })}/>Enable completion sound</label><button className="button danger-outline" onClick={() => { if (confirm("Reset all demo observations, issues, and runs?"))
        session.reset(); }}>Reset demo</button></Modal>;
}
function CommandPalette() {
    const s = useRehearsal();
    const commands = [{ label: "Teach the next example", action: () => session.startObservation() }, { label: s.paused ? "Resume observation" : "Pause observation", action: () => session.setPaused(!s.paused) }, { label: "Inspect Ghost Run", action: () => session.update({ ghostOpen: true }) }, { label: "Open demo controls", action: () => session.update({ demoOpen: true }) }];
    return <Modal title="What would you like to do?" onClose={() => session.update({ commandOpen: false })}><div className="command-list">{commands.map(c => <button key={c.label} onClick={() => { session.update({ commandOpen: false }); perform(c.action); }}>{c.label}<span>↵</span></button>)}{["workspace", "workflows", "activity", "privacy"].map(route => <Link key={route} href={`/${route}`} onClick={() => session.update({ commandOpen: false })}>Go to {route}<ArrowUpRight size={16}/></Link>)}</div></Modal>;
}
