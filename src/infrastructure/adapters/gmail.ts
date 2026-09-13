import { nodeService } from "../api-clients/node-services.ts";
import { reportSchema } from "../api-clients/contracts.ts";
import { z } from "zod";
import type { Environment } from "../../config/environment.ts";
import type { ExecutionAdapter } from "../../domain/runs/ports.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import type { Report } from "../../domain/understanding/classifier.ts";
import { requestJson, jsonRequest, IntegrationError, type HttpClient } from "../api-clients/http.ts";
export interface GoogleTokens {
    access_token: string;
    refresh_token?: string;
    expires_at: number;
    scope: string;
}
const tokenSchema = z.object({ access_token: z.string(), refresh_token: z.string().optional(), expires_in: z.number(), scope: z.string().optional() });
export class GmailAdapter implements ExecutionAdapter {
    readonly name = "gmail";
    readonly #env: Environment;
    readonly #client: HttpClient;
    #tokens: GoogleTokens | null = null;
    constructor(env: Environment, client: HttpClient = fetch) { this.#env = env; this.#client = client; }
    setTokens(tokens: GoogleTokens): void { this.#tokens = tokens; }
    get canSend(): boolean { if (this.#env.GMAIL_APP_PASSWORD)
        return this.#env.GMAIL_SEND_ENABLED === "true"; return this.#tokens?.scope.split(" ").includes("https://www.googleapis.com/auth/gmail.send") ?? false; }
    async exchange(code: string): Promise<GoogleTokens> {
        const env = this.#env;
        const raw = await requestJson("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID ?? "", client_secret: env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: env.GOOGLE_REDIRECT_URI, grant_type: "authorization_code" }).toString() }, this.#client);
        const t = tokenSchema.parse(raw);
        const tokens = { ...t, expires_at: Date.now() + t.expires_in * 1000, scope: t.scope ?? "" };
        this.#tokens = tokens;
        return tokens;
    }
    async #accessToken(): Promise<string> {
        if (this.#tokens && this.#tokens.expires_at > Date.now() + 60000)
            return this.#tokens.access_token;
        const refresh = this.#tokens?.refresh_token ?? this.#env.GOOGLE_REFRESH_TOKEN;
        if (!refresh)
            throw new IntegrationError("GMAIL_NOT_CONNECTED", "Connect Gmail with OAuth before accessing live mail.");
        const t = tokenSchema.parse(await requestJson("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: this.#env.GOOGLE_CLIENT_ID ?? "", client_secret: this.#env.GOOGLE_CLIENT_SECRET ?? "", refresh_token: refresh, grant_type: "refresh_token" }).toString() }, this.#client));
        this.#tokens = { access_token: t.access_token, refresh_token: refresh, expires_at: Date.now() + t.expires_in * 1000, scope: t.scope ?? this.#tokens?.scope ?? "" };
        return t.access_token;
    }
    async list(): Promise<Report[]> {
        if (this.#env.GMAIL_APP_PASSWORD)
            return z.object({ reports: z.array(reportSchema) }).parse(await nodeService(this.#env, "/mail/list", {}, this.#client)).reports;
        const token = await this.#accessToken();
        const headers = { Authorization: `Bearer ${token}` };
        const data = z.object({ messages: z.array(z.object({ id: z.string(), threadId: z.string() })).optional() }).parse(await requestJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(this.#env.GMAIL_QUERY)}`, { headers }, this.#client));
        const reports: Report[] = [];
        for (const entry of data.messages ?? []) {
            const raw = await requestJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(entry.id)}?format=full`, { headers }, this.#client);
            const message = gmailMessageSchema.parse(raw);
            const h = (name: string) => message.payload.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
            const from = h("from");
            const senderEmail = from.match(/<?([^<>\s]+@[^<>\s]+)>?$/)?.[1];
            const body = plainBody(message.payload);
            if (!body)
                continue;
            reports.push({ id: entry.id, threadId: entry.threadId, receivedAt: new Date(Number(message.internalDate)).toISOString(), subject: h("subject") || "Support report", body: body.slice(0, 20000), senderName: from.replace(/<.*>$/, "").replaceAll('"', "").trim() || senderEmail, senderEmail, unread: message.labelIds?.includes("UNREAD") ?? false });
        }
        return reports;
    }
    async perform(action: PlannedAction) {
        if (this.#env.GMAIL_APP_PASSWORD) {
            if (!this.canSend)
                throw new IntegrationError("GMAIL_SEND_NOT_AUTHORIZED", "Explicitly enable Gmail sending before approving replies.");
            return z.object({ status: z.literal("succeeded"), externalReference: z.string().min(1) }).parse(await nodeService(this.#env, "/mail/send", action.resolvedInput, this.#client));
        }
        const token = await this.#accessToken();
        if (!this.canSend)
            throw new IntegrationError("GMAIL_SEND_NOT_AUTHORIZED", "Gmail send scope has not been authorized.");
        const p = action.resolvedInput;
        const to = z.string().email().parse(p.to);
        const subject = z.string().max(500).parse(p.subject);
        if (/[\r\n]/.test(to + subject))
            throw new IntegrationError("INVALID_MAIL_HEADER", "Mail headers cannot contain newlines.");
        const rawMime = [`To: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(String(p.text)).toString("base64")].join("\r\n");
        const response = z.object({ id: z.string() }).parse(await requestJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", jsonRequest("POST", { raw: Buffer.from(rawMime).toString("base64url"), ...(p.threadId ? { threadId: p.threadId } : {}) }, { Authorization: `Bearer ${token}` }), this.#client));
        return { status: "succeeded" as const, externalReference: response.id };
    }
}
type MailPart = {
    mimeType?: string;
    body?: {
        data?: string;
    };
    parts?: MailPart[];
    headers?: {
        name: string;
        value: string;
    }[];
};
const partSchema: z.ZodType<MailPart> = z.lazy(() => z.object({ mimeType: z.string().optional(), body: z.object({ data: z.string().optional() }).optional(), parts: z.array(partSchema).optional(), headers: z.array(z.object({ name: z.string(), value: z.string() })).optional() }));
const gmailMessageSchema = z.object({ internalDate: z.string(), labelIds: z.array(z.string()).optional(), payload: partSchema });
function plainBody(part: MailPart): string { if (part.mimeType === "text/plain" && part.body?.data)
    return Buffer.from(part.body.data, "base64url").toString("utf8"); return (part.parts ?? []).map(plainBody).filter(Boolean).join("\n"); }
