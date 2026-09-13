import { SemanticTraceBuilder } from "../../domain/events/trace-builder.ts";
import { calculateLiveMatchConfidence } from "../../domain/patterns/pattern-detection.ts";
import { detectPattern } from "../../domain/patterns/compiler.ts";
import { understandReport, type Report } from "../../domain/understanding/classifier.ts";
import { routeDepartment, type ResolvedDepartment } from "../../domain/understanding/routing.ts";
import { planRun, approveRun } from "../../domain/runs/planner.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import type { SemanticAction, SourceApplication } from "../../domain/events/taxonomy.ts";
import { MemoryAdapters } from "../../demo/adapters/memory.ts";
import { trainingReports, billingReport, reviewReport } from "../../demo/fixtures/workspace.ts";
import { RunExecutor } from "../engine/executor.ts";
import { transition, type Phase } from "../state-machine/transitions.ts";
import { initialEngine, type EngineSlice, type TimelineEntry } from "../../store/engine-slice.ts";
import { initialWorkspace, type WorkspaceSlice } from "../../store/workspace-slice.ts";
import { initialPresentation, type PresentationSlice } from "../../store/presentation-slice.ts";
import { initialIntegration, type IntegrationSlice } from "../../store/integration-slice.ts";
export type SessionState = EngineSlice & WorkspaceSlice & PresentationSlice & IntegrationSlice;
export const MANUAL_STEPS = ["Read report", "Inspect details", "Draft issue", "Apply labels & priority", "Assign owner", "Create issue", "Open team channel", "Draft notification", "Send notification", "Draft customer reply", "Send customer reply"] as const;
const initialState = (): SessionState => ({ ...initialEngine(), ...initialWorkspace(), ...initialPresentation(), ...initialIntegration() });
export class RehearsalSession {
    #state: SessionState = initialState();
    #listeners = new Set<() => void>();
    #builder: SemanticTraceBuilder | null = null;
    #memory = new MemoryAdapters(1045);
    #executor = new RunExecutor(this.#memory);
    #clock = 0;
    #manualIssueId = "";
    #executing = false;
    #handledReports = new Set<string>();
    getSnapshot = (): SessionState => this.#state;
    subscribe = (fn: () => void) => { this.#listeners.add(fn); return () => { this.#listeners.delete(fn); }; };
    update(values: Partial<SessionState>): void { this.#state = { ...this.#state, ...values }; this.#listeners.forEach(fn => fn()); }
    #phase(phase: Phase): void { this.update({ phase: transition(this.#state.phase, phase) }); }
    #log(kind: TimelineEntry["kind"], title: string, detail = ""): void {
        this.update({ timeline: [...this.#state.timeline.slice(-499), { id: `entry-${++this.#clock}`, timestamp: new Date().toISOString(), kind, title, detail }] });
    }
    selectReport(id: string): void { if (this.#state.manualStep >= 0 && id !== this.#state.selectedReportId)
        return; this.update({ selectedReportId: id }); }
    startObservation(): void {
        if (this.#state.paused)
            throw new Error("Resume observation first.");
        if (this.#state.excludedApps.length)
            throw new Error("Enable all three demo sources to teach the complete workflow.");
        if (!["idle", "observing"].includes(this.#state.phase) || this.#builder)
            throw new Error("Finish the active workflow first.");
        const report = trainingReports[this.#state.traces.length];
        if (!report)
            throw new Error("Both examples have been observed.");
        this.#phase("observing");
        this.#builder = new SemanticTraceBuilder({ traceId: `trace-manual-${this.#state.traces.length + 1}`, startedAt: new Date().toISOString(), excludedApplications: this.#state.excludedApps });
        this.update({ selectedReportId: report.id, reports: this.#state.reports.some(r => r.id === report.id) ? this.#state.reports : [report, ...this.#state.reports], manualStep: 0 });
        this.#log("decision", `Observation ${this.#state.traces.length + 1} started`, "Only semantic actions from the supported work surfaces are recorded.");
    }
    #observe(app: SourceApplication, action: SemanticAction, payload: Record<string, unknown> = {}): void {
        if (!this.#builder || this.#state.paused || this.#state.excludedApps.includes(app))
            return;
        const events = this.#builder.append({ occurredAt: new Date(Date.now() + this.#clock).toISOString(), sourceApplication: app, action, payload });
        events.forEach(e => this.#log(e.origin === "inferred" ? "inferred" : "observed", e.intent, `${e.sourceApplication.replaceAll("_", " ")} · ${e.confidence === 1 ? "direct observation" : `${Math.round(e.confidence * 100)}% confidence`}`));
        const activeTrace = this.#builder.toTrace();
        this.update({ activeTrace, liveConfidence: calculateLiveMatchConfidence(this.#state.traces, activeTrace) });
    }
    manualNext(): void {
        if (!this.#builder || this.#state.paused)
            return;
        const report = trainingReports[this.#state.traces.length];
        const u = understandReport(report);
        const step = this.#state.manualStep;
        const route = routeDepartment(u.issue.department)!;
        if (step === 0) {
            this.#observe("mail", "report_received", { reportId: report.id, subject: report.subject });
        }
        if (step === 1 && this.#state.traces.length === 1)
            this.#observe("mail", "read_report", { reportId: report.id });
        if (step === 2)
            this.#log("decision", "Issue draft prepared", "Drafts stay local. Creating the issue is a separate manual action.");
        if (step === 5) {
            const number = Math.max(1042, ...this.#state.issues.map(i => Number(i.id.replace("RHR-", ""))).filter(Number.isFinite)) + 1;
            this.#manualIssueId = `RHR-${number}`;
            this.#memory.reserveIssueNumber(number);
            this.update({ issues: [{ id: this.#manualIssueId, title: u.issue.title, description: u.issue.description, owner: u.owner, department: u.issue.department, labels: u.issue.labels, severity: u.issue.severity }, ...this.#state.issues] });
            this.#observe("issue_tracker", "create_issue", { reportId: report.id, customerName: u.customer.name, customerEmail: u.customer.email, issueTitle: u.issue.title, issueDescription: u.issue.description, category: u.issue.category, department: u.issue.department, severity: u.issue.severity, labels: u.issue.labels });
            this.#observe("issue_tracker", "assign_owner", { owner: u.owner, department: u.issue.department });
        }
        if (step === 6)
            this.update({ channel: route.channel });
        if (step === 8) {
            this.update({ messages: [...this.#state.messages, { id: `manual-chat-${++this.#clock}`, channel: route.channel, author: "You", text: `[${u.issue.category}] ${u.customer.name}: ${u.issue.title}. ${this.#manualIssueId} → ${u.owner}.` }] });
            this.#observe("team_chat", "send_team_notification", { department: u.issue.department, owner: u.owner, channel: route.channel });
        }
        if (step === 10) {
            this.update({ replies: [...this.#state.replies, { id: `manual-reply-${++this.#clock}`, to: u.customer.email!, subject: `Re: ${u.issue.title}`, text: `Hi ${u.customer.name}, thanks for reporting this. ${u.owner} will review ${this.#manualIssueId} and follow up.`, reportId: report.id }] });
            this.#observe("mail", "reply_to_customer", { reportId: report.id, customerName: u.customer.name, responseType: "acknowledgement" });
            const trace = this.#builder.complete(new Date().toISOString());
            this.#builder = null;
            const traces = [...this.#state.traces, trace];
            this.update({ traces, activeTrace: null, manualStep: -1 });
            this.#phase("comparing");
            const pattern = detectPattern(traces);
            this.update({ pattern });
            if (pattern) {
                this.#phase("pattern_discovered");
                this.#log("decision", "A repeatable workflow was discovered", `${traces.length} observations · ${Math.round(pattern.confidence * 100)}% confidence after the sample-size discount.`);
            }
            else {
                this.#phase("observing");
                this.#log("decision", "One example is evidence, not a pattern", "Teach a second report to test whether the same workflow repeats.");
            }
            return;
        }
        this.update({ manualStep: step + 1 });
    }
    instantObservation(): void { this.startObservation(); for (let i = 0; i < MANUAL_STEPS.length; i++)
        this.manualNext(); }
    activate(): void {
        if (!this.#state.pattern)
            throw new Error("Observe two completed examples first.");
        this.update({ pattern: { ...this.#state.pattern, status: "active" } });
        this.#phase("agent_ready");
        this.#log("approval", "Workflow activated", "New reports can be planned. Every run still requires its own approval.");
    }
    pauseWorkflow(): void { if (this.#executing)
        return; if (this.#state.pattern)
        this.update({ pattern: { ...this.#state.pattern, status: "proposed" } }); }
    reactivateWorkflow(): void { if (this.#state.pattern)
        this.update({ pattern: { ...this.#state.pattern, status: "active" } }); }
    deliver(ambiguous = false): void {
        if (this.#state.pattern?.status !== "active")
            throw new Error("Activate the learned workflow first.");
        const report = ambiguous ? reviewReport : billingReport;
        if (this.#handledReports.has(report.id))
            throw new Error("This report already has a run. Reset the demo to repeat it.");
        this.#phase("trigger_detected");
        this.update({ reports: this.#state.reports.some(r => r.id === report.id) ? this.#state.reports : [report, ...this.#state.reports], selectedReportId: report.id });
        this.#log("decision", "New support report detected", report.subject);
        this.#phase("planning");
        this.#plan(report);
        this.#handledReports.add(report.id);
    }
    #plan(report: Report): void {
        const run = planRun(this.#state.pattern!, understandReport(report));
        this.update({ run });
        this.#phase(run.status === "needs_review" ? "needs_review" : "ghost_run");
        this.#log("decision", run.status === "needs_review" ? "Human review is required" : "Ghost Run prepared", run.status === "needs_review" ? "The report does not provide enough evidence to choose a department." : "All destinations and values are resolved. No actions have executed.");
    }
    resolveReview(department: ResolvedDepartment): void {
        const run = this.#state.run;
        if (run?.status !== "needs_review")
            return;
        this.#phase("planning");
        const u = { ...run.understanding, issue: { ...run.understanding.issue, department, severity: "medium" as const, labels: ["support", "human-reviewed"] }, owner: routeDepartment(department)!.owner, reviewRequired: false, confidence: { ...run.understanding.confidence, overall: 1 }, provenance: { provider: "human", model: "explicit-review", validated: true, latencyMs: 0 } };
        this.update({ run: planRun(this.#state.pattern!, u, { id: run.id }) });
        this.#phase("ghost_run");
        this.#log("approval", "Routing resolved by you", `Explicit department selection: ${routeDepartment(department)!.label}. Review and approve the revised plan.`);
    }
    async execute(retry = false): Promise<void> {
        if (this.#executing || !this.#state.run)
            return;
        if (this.#state.run.status === "needs_review")
            throw new Error("Resolve the report first.");
        this.#executing = true;
        try {
            const run = retry ? this.#state.run : approveRun(this.#state.run, "local-reviewer");
            this.#log("approval", retry ? "Retry requested" : "Ghost Run approved by you", retry ? "Completed adapter receipts will be reused." : "Approval is bound to this exact plan.");
            this.#phase("executing");
            const completed = await this.#executor.execute(run, progress => {
                this.update({ run: progress });
                const manualIssues = this.#state.issues.filter(i => !this.#memory.issues.some(m => m.id === i.id));
                this.update({ issues: [...this.#memory.issues.map(i => ({ ...i })), ...manualIssues], messages: [...this.#state.messages.filter(m => !m.id.startsWith("message-")), ...this.#memory.messages], replies: [...this.#state.replies.filter(r => !r.id.startsWith("reply-")), ...this.#memory.replies] });
            });
            this.update({ run: completed, history: [...this.#state.history.filter(r => r.id !== completed.id), completed], channel: routeDepartment(completed.understanding.issue.department)?.channel ?? this.#state.channel });
            this.#phase(completed.status === "completed" ? "completed" : "failed");
            completed.results.forEach(r => this.#log(r.status === "succeeded" ? "executed" : "failure", `${completed.plannedActions.find(a => a.id === r.actionId)?.action.replaceAll("_", " ")} · ${r.status}`, r.externalReference ?? r.error?.message ?? "Verified local analysis"));
        }
        finally {
            this.#executing = false;
        }
    }
    cancel(): void { if (!this.#state.run || this.#executing)
        return; const run = { ...this.#state.run, status: "cancelled" as const }; if (!run.results.some(r => r.status === "succeeded" && r.externalReference))
        this.#handledReports.delete(run.triggerReportId); this.update({ run, ghostOpen: false, history: [...this.#state.history.filter(r => r.id !== run.id), run] }); this.#phase("cancelled"); this.#log("decision", "Run cancelled", "No further actions will execute."); }
    failOnce(action: PlannedAction["action"]): void { this.#memory.failOnce(action); this.#log("decision", "Demo failure armed", action.replaceAll("_", " ")); }
    setPaused(paused: boolean): void { this.update({ paused }); if (paused)
        this.#builder?.pause();
    else
        this.#builder?.resume(); this.#log("decision", paused ? "Observation paused" : "Observation resumed"); }
    setExcluded(app: SourceApplication, excluded: boolean): void { if (this.#builder)
        throw new Error("Finish the current observation before changing sources."); this.update({ excludedApps: excluded ? [...new Set([...this.#state.excludedApps, app])] : this.#state.excludedApps.filter(a => a !== app) }); }
    clearHistory(): void { if (this.#executing)
        return; this.update({ timeline: [], history: [] }); }
    forget(): void { if (this.#executing)
        return; this.#builder = null; this.update({ ...initialEngine(), manualStep: -1, ghostOpen: false }); }
    reset(): void { if (this.#executing)
        return; this.#builder = null; this.#memory = new MemoryAdapters(1045); this.#executor = new RunExecutor(this.#memory); this.#clock = 0; this.#handledReports.clear(); this.update(initialState()); }
}
