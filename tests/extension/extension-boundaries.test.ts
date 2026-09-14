import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";

const extensionRoot = join(process.cwd(), "extension");

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1_000,
): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for the extension worker.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("the Manifest V3 package contains every declared script and icon", async () => {
  const manifest = JSON.parse(
    await readFile(join(extensionRoot, "manifest.json"), "utf8"),
  ) as {
    manifest_version: number;
    background: { service_worker: string };
    action: { default_popup: string };
    icons: Record<string, string>;
    content_scripts: readonly { js: readonly string[] }[];
  };
  assert.equal(manifest.manifest_version, 3);
  const declaredFiles = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap((entry) => entry.js),
    "popup.css",
    "popup.js",
  ];
  for (const relativePath of new Set(declaredFiles)) {
    const content = await readFile(join(extensionRoot, relativePath));
    assert.ok(content.length > 0, `${relativePath} must not be empty`);
  }

  for (const [size, relativePath] of Object.entries(manifest.icons)) {
    const png = await readFile(join(extensionRoot, relativePath));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
});

test("the Gmail extractor never reads rendered message bodies", async () => {
  const source = await readFile(
    join(extensionRoot, "extractors", "gmail.js"),
    "utf8",
  );
  assert.equal(source.includes("innerText"), false);
  assert.equal(source.includes("innerHTML"), false);
  assert.equal(source.includes("textContent ?? subject"), false);
  assert.match(source, /messageId/);
  assert.match(source, /senderAddress/);
});

test("the background worker scrubs untrusted events and completes one shared trace", async () => {
  let storageState: Record<string, unknown> = {};
  let messageListener:
    | ((
        message: unknown,
        sender: unknown,
        respond: (value: unknown) => void,
      ) => boolean)
    | null = null;
  const postedBodies: Array<{
    events: Array<Record<string, unknown>>;
    completedTraceIds: string[];
  }> = [];
  const chromeMock = {
    action: {
      async setBadgeBackgroundColor() {},
      async setBadgeText() {},
    },
    alarms: {
      async create() {},
      onAlarm: { addListener() {} },
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener: typeof messageListener) {
          messageListener = listener;
        },
      },
      onStartup: { addListener() {} },
    },
    storage: {
      local: {
        async get(defaults: Record<string, unknown>) {
          return { ...defaults, ...storageState };
        },
        async set(nextState: Record<string, unknown>) {
          storageState = { ...storageState, ...nextState };
        },
      },
    },
  };
  const workerSource = await readFile(
    join(extensionRoot, "background.js"),
    "utf8",
  );
  const context = vm.createContext({
    AbortController,
    chrome: chromeMock,
    crypto: webcrypto,
    fetch: async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        events: Array<Record<string, unknown>>;
        completedTraceIds: string[];
      };
      postedBodies.push(body);
      return new Response(
        JSON.stringify({
          ok: true,
          accepted: body.events.length + body.completedTraceIds.length,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
    Response,
    setTimeout,
    clearTimeout,
    TextDecoder,
    URL,
  });
  vm.runInContext(workerSource, context, { filename: "background.js" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(messageListener !== null);

  const sendMessage = (message: unknown) =>
    new Promise<unknown>((resolve) => {
      assert.ok(messageListener !== null);
      messageListener(message, {}, resolve);
    });
  await sendMessage({
    type: "semantic-events",
    events: [
      {
        traceId: "attacker-controlled-trace",
        occurredAt: "2026-01-01T00:00:00.000Z",
        sourceApplication: "issue_tracker",
        action: "create_issue",
        intent: "Create a support issue",
        payload: {
          issueKey: "SUP-42",
          password: "never-store-this",
          cardNumber: "4111111111111111",
          coordinates: { x: 10, y: 20 },
          cssSelector: "#create",
          rawKey: "Enter",
          path: "/browse/SUP-42?token=private#activity",
          nested: { safe: "retained" },
        },
      },
    ],
  });
  await waitFor(() => postedBodies.length >= 1);
  const postedEvent = postedBodies[0]?.events[0];
  assert.ok(postedEvent !== undefined);
  assert.match(String(postedEvent.traceId), /^extension-trace-/);
  assert.notEqual(postedEvent.traceId, "attacker-controlled-trace");
  assert.deepEqual(JSON.parse(JSON.stringify(postedEvent.payload)), {
    issueKey: "SUP-42",
    nested: { safe: "retained" },
    path: "/browse/:issue",
  });

  await sendMessage({ type: "finish-observation" });
  await waitFor(() =>
    postedBodies.some((body) => body.completedTraceIds.length > 0),
  );
  const completion = postedBodies.find(
    (body) => body.completedTraceIds.length > 0,
  );
  assert.deepEqual(completion?.completedTraceIds, [postedEvent.traceId]);
});
