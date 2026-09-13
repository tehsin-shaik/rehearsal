import { test } from "node:test";
import assert from "node:assert/strict";
import { createBridge, mailServices } from "./server.mjs";
test("bridge authenticates, exposes CopilotKit runtime, and keeps mail effects explicit", async () => {
    const key = "test-bridge-key-at-least-24-characters";
    let sends = 0;
    const server = createBridge({ REHEARSAL_BRIDGE_KEY: key }, { list: async () => ({ reports: [] }), send: async () => {
            sends++;
            return { status: "succeeded", externalReference: "mock-mail-1" };
        } });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const headers = { "x-rehearsal-bridge": key, "Content-Type": "application/json" };
    try {
        assert.equal((await fetch(url + "/mail/list", { method: "POST", body: "{}" })).status, 401);
        assert.deepEqual(await (await fetch(url + "/mail/list", { method: "POST", headers, body: "{}" })).json(), { reports: [] });
        assert.equal(sends, 0);
        const info = await fetch(url + "/api/copilotkit/info", { headers: { ...headers, cookie: "rehearsal_session=test" } });
        assert.equal(info.status, 200);
        assert.match(await info.text(), /rehearsal/);
        assert.equal(sends, 0);
        await fetch(url + "/mail/send", { method: "POST", headers, body: "{}" });
        assert.equal(sends, 1);
    }
    finally {
        await new Promise(resolve => server.close(resolve));
    }
});
test("app-password sending requires a separate opt-in", async () => {
    await assert.rejects(mailServices({}).send({}), /disabled/);
    await assert.rejects(mailServices({ GMAIL_SEND_ENABLED: "true" }).send({ to: "bad\r\nheader" }), /Invalid/);
});

test("CopilotKit forwards authenticated AG-UI proposals without an execution capability", async () => {
    const { createServer } = await import("node:http");
    let proposalRequests = 0;
    const backend = createServer(async (req, res) => {
        assert.equal(req.url, "/api/ag-ui");
        assert.equal(req.headers.cookie, "rehearsal_session=stream-test");
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const input = JSON.parse(Buffer.concat(chunks).toString());
        proposalRequests++;
        const events = [
            { type: "RUN_STARTED", threadId: input.threadId, runId: input.runId },
            { type: "TOOL_CALL_START", toolCallId: "proposal-1", toolCallName: "proposeRun" },
            { type: "TOOL_CALL_ARGS", toolCallId: "proposal-1", delta: JSON.stringify({ id: input.forwardedProps.rehearsalRunId, status: "ghost_run" }) },
            { type: "TOOL_CALL_END", toolCallId: "proposal-1" },
            { type: "STATE_SNAPSHOT", snapshot: { status: "ghost_run" } },
            { type: "RUN_FINISHED", threadId: input.threadId, runId: input.runId },
        ];
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.end(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(""));
    });
    await new Promise(resolve => backend.listen(0, "127.0.0.1", resolve));
    const key = "test-stream-bridge-key-at-least-24-characters";
    const server = createBridge({ REHEARSAL_BRIDGE_KEY: key, REHEARSAL_BASE_URL: `http://127.0.0.1:${backend.address().port}` }, { list: async () => { throw new Error("Mail must not be read by runtime"); }, send: async () => { throw new Error("Runtime cannot send mail"); } });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/copilotkit/agent/rehearsal/run`, {
            method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream", "x-rehearsal-bridge": key, cookie: "rehearsal_session=stream-test" },
            body: JSON.stringify({ threadId: "thread-1", runId: "transport-1", state: {}, messages: [], tools: [], context: [], forwardedProps: { rehearsalRunId: "server-owned-plan" } }),
        });
        assert.equal(response.status, 200);
        const text = await response.text();
        assert.match(text, /proposeRun/); assert.match(text, /server-owned-plan/); assert.match(text, /RUN_FINISHED/);
        assert.equal(proposalRequests, 1);
    } finally { await new Promise(resolve => server.close(resolve)); await new Promise(resolve => backend.close(resolve)); }
});
