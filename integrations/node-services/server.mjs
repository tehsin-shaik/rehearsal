import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";
import { HttpAgent } from "@ag-ui/client";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
function authorized(candidate, key) {
    if (typeof candidate !== "string" || !key || key.length < 24)
        return false;
    const a = Buffer.from(candidate), b = Buffer.from(key);
    return a.length === b.length && timingSafeEqual(a, b);
}
export function mailServices(env) {
    function credentials() {
        if (!env.GMAIL_ADDRESS || !env.GMAIL_APP_PASSWORD)
            throw new Error("Gmail app-password credentials are missing.");
        return { user: env.GMAIL_ADDRESS, pass: env.GMAIL_APP_PASSWORD.replaceAll(" ", "") };
    }
    return {
        async list() {
            const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: credentials(), logger: false, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
            try {
                await client.connect();
                const lock = await client.getMailboxLock("INBOX", { readOnly: true });
                try {
                    const found = await client.search({ seen: false }, { uid: true });
                    const ids = (found || []).slice(-20);
                    if (!ids.length)
                        return { reports: [] };
                    const reports = [];
                    for await (const message of client.fetch(ids.join(","), { uid: true, source: true, internalDate: true }, { uid: true })) {
                        if (!message.source || message.source.length > 1000000)
                            continue;
                        const mail = await simpleParser(message.source, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true });
                        const from = mail.from?.value[0];
                        if (!mail.text || !from?.address)
                            continue;
                        reports.push({ id: `imap-${client.mailbox.uidValidity}-${message.uid}`, receivedAt: new Date(message.internalDate || Date.now()).toISOString(), subject: mail.subject || "Support report", body: mail.text.slice(0, 20000), senderName: from.name || from.address, senderEmail: from.address, unread: true });
                    }
                    return { reports: reports.reverse() };
                }
                finally {
                    lock.release();
                }
            }
            finally {
                await client.logout().catch(() => client.close());
            }
        },
        async send(input) {
            if (env.GMAIL_SEND_ENABLED !== "true")
                throw new Error("SMTP sending is disabled.");
            if (typeof input.to !== "string" || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(input.to) || /[\r\n]/.test(input.to) || typeof input.subject !== "string" || /[\r\n]/.test(input.subject) || input.subject.length > 500 || typeof input.text !== "string" || input.text.length > 40000)
                throw new Error("Invalid message.");
            const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: credentials(), connectionTimeout: 10000, socketTimeout: 15000, logger: false, debug: false });
            try {
                const receipt = await transport.sendMail({ from: env.GMAIL_ADDRESS, to: input.to, subject: input.subject, text: input.text, disableFileAccess: true, disableUrlAccess: true });
                if (!receipt.messageId || !receipt.accepted?.length || receipt.rejected?.length)
                    throw new Error("SMTP did not accept the message.");
                return { status: "succeeded", externalReference: receipt.messageId };
            }
            finally {
                transport.close();
            }
        },
    };
}
export function createBridge(env = process.env, mail = mailServices(env)) {
    const origin = new URL(env.REHEARSAL_BASE_URL || "http://localhost:3000");
    if (!["localhost", "127.0.0.1"].includes(origin.hostname))
        throw new Error("Optional services require a local Rehearsal app.");
    const runtimes = new Map();
    return createServer(async (req, res) => {
        const json = (status, data) => {
            res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
            res.end(JSON.stringify(data));
        };
        if (!authorized(req.headers["x-rehearsal-bridge"], env.REHEARSAL_BRIDGE_KEY))
            return json(401, { error: "Bridge authentication required." });
        try {
            const path = new URL(req.url || "/", "http://127.0.0.1:4001").pathname;
            if (path.startsWith("/api/copilotkit")) {
                const cookie = req.headers.cookie;
                if (!cookie)
                    return json(401, { error: "A Rehearsal session is required." });
                for (const [key, value] of runtimes)
                    if (value.expires < Date.now())
                        runtimes.delete(key);
                let saved = runtimes.get(cookie);
                if (!saved) {
                    if (runtimes.size >= 100)
                        return json(429, { error: "Too many runtime sessions." });
                    const runtime = new CopilotRuntime({ agents: { rehearsal: new HttpAgent({ url: `${origin.origin}/api/ag-ui`, headers: { cookie, origin: origin.origin } }) } });
                    saved = { expires: Date.now() + 8 * 3600000, handler: createCopilotNodeListener({ runtime, basePath: "/api/copilotkit", mode: "multi-route", activateChannels: false }) };
                    runtimes.set(cookie, saved);
                }
                await saved.handler(req, res);
                return;
            }
            if (req.method !== "POST" || !["/mail/list", "/mail/send"].includes(path))
                return json(404, { error: "Unknown service." });
            let size = 0;
            const chunks = [];
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 65000)
                    return json(413, { error: "Request too large." });
                chunks.push(chunk);
            }
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            json(200, path === "/mail/list" ? await mail.list() : await mail.send(body));
        }
        catch {
            if (!res.headersSent)
                json(502, { error: "Optional service did not confirm success. Check setup and reconcile uncertain sends." });
            else
                res.end();
        }
    });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (process.env.DEMO_MODE !== "false")
        throw new Error("Optional live services require DEMO_MODE=false.");
    if (!process.env.REHEARSAL_BRIDGE_KEY || process.env.REHEARSAL_BRIDGE_KEY.length < 24)
        throw new Error("Set a bridge key of at least 24 characters.");
    createBridge().listen(4001, "127.0.0.1", () => console.log("Rehearsal optional services listening on 127.0.0.1:4001"));
}
