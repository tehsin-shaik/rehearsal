import { test } from "node:test";
import assert from "node:assert/strict";
import { createBridge, mailServices } from "./server.mjs";
test("bridge authenticates, exposes CopilotKit runtime, and keeps mail effects explicit", async () => {
    const key = "test-bridge-key-at-least-24-characters";
    let sends = 0;
    const server = createBridge({ REHEARSAL_BRIDGE_KEY: key }, { list: async () => ({ reports: [] }), send: async () => { sends++; return { status: "succeeded", externalReference: "mock-mail-1" }; } });
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
