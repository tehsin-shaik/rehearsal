import assert from "node:assert/strict";
import { environment, isDemo, selectedTracker } from "../src/config/environment.ts";
import { understandWithResearch } from "../src/infrastructure/api-clients/understanding.ts";
import { TrackerAdapter } from "../src/infrastructure/adapters/trackers.ts";
import { GmailAdapter } from "../src/infrastructure/adapters/gmail.ts";
import { billingReport } from "../src/demo/fixtures/workspace.ts";
// This verification never creates issues, sends messages, or modifies mail.
const env = environment();
const mode = process.argv[2] || "understanding";
if (isDemo(env)) {
    console.log("SKIPPED: live verification needs both demo flags set to false.");
    process.exit(0);
}
if (mode === "ambiguous") {
    console.error("UNAVAILABLE: the Ambiguous API contract has not been verified. No request or write was attempted.");
    process.exit(2);
}
if (mode === "surfaces") {
    let checks = 0;
    if (selectedTracker(env)) {
        const issues = await new TrackerAdapter(env).list();
        console.log(`PASS: selected tracker returned ${issues.length} issues (read only).`);
        checks++;
    }
    if (env.GOOGLE_REFRESH_TOKEN || env.GMAIL_APP_PASSWORD) {
        const reports = await new GmailAdapter(env).list();
        console.log(`PASS: Gmail returned ${reports.length} plain-text reports (read only).`);
        checks++;
    }
    if (!checks)
        console.log("SKIPPED: configure tracker or Gmail credentials first.");
}
else {
    if (!env.OPENROUTER_API_KEY && !env.OPENAI_API_KEY && !env.GEMINI_API_KEY) {
        console.log("SKIPPED: no model credentials configured.");
        process.exit(0);
    }
    const result = await understandWithResearch(billingReport, env);
    assert.equal(result.issue.department, "billing");
    assert.equal(result.owner, "Awaiz");
    assert.equal(result.reviewRequired, false);
    if (result.provenance?.provider === "deterministic")
        throw new Error("Live provider fell back. Inspect model configuration; this is not a live-provider pass.");
    console.log(`PASS: ${result.provenance?.provider} produced validated billing understanding. No external actions executed.`);
}
