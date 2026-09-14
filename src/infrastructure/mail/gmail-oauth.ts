import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import type {
  CustomerMailAdapter,
  CustomerReplyInput,
} from "../adapters/contracts.ts";
import {
  failedActionResult,
  successfulActionResult,
} from "../adapters/live/adapter-result.ts";
import {
  fetchJsonWithTimeout,
  type FetchImplementation,
} from "../http/index.ts";
import type {
  ConnectedMailMessage,
  MailSurfaceResult,
  ReadOnlyMailSurface,
} from "./mail-surface.ts";

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

const persistedTokenSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string().nullable(),
    expiresAt: z.number().int().positive(),
    scope: z.string().nullable(),
  })
  .strict();

const messageListSchema = z.object({
  messages: z
    .array(z.object({ id: z.string(), threadId: z.string().optional() }))
    .optional()
    .default([]),
});

const messagePartSchema: z.ZodType<GmailMessagePart> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    headers: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .optional()
      .default([]),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(messagePartSchema).optional(),
  }),
);

const gmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional().default([]),
  snippet: z.string().optional().default(""),
  internalDate: z.string().optional(),
  payload: messagePartSchema,
});

const sendResponseSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
});

interface GmailMessagePart {
  readonly mimeType?: string;
  readonly headers: readonly {
    readonly name: string;
    readonly value: string;
  }[];
  readonly body?: { readonly data?: string };
  readonly parts?: readonly GmailMessagePart[];
}

export interface StoredGoogleToken {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: number;
  readonly scope: string | null;
}

export interface GoogleTokenStore {
  read(): Promise<StoredGoogleToken | null>;
  write(token: StoredGoogleToken): Promise<void>;
}

export class LocalGoogleTokenStore implements GoogleTokenStore {
  readonly #directory: string;
  readonly #path: string;

  constructor(root = process.cwd()) {
    this.#directory = join(root, ".rehearsal");
    this.#path = join(this.#directory, "gmail-oauth-token.json");
  }

  async read(): Promise<StoredGoogleToken | null> {
    try {
      const content = await readFile(this.#path, "utf8");
      const parsed = persistedTokenSchema.safeParse(JSON.parse(content));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async write(token: StoredGoogleToken): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    const temporaryPath = `${this.#path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(token), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.#path);
  }
}

export interface GmailOAuthConfiguration {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly address?: string;
  readonly query?: string;
  readonly tokenStore?: GoogleTokenStore;
  readonly fetchImplementation?: FetchImplementation;
}

function headerValue(part: GmailMessagePart, name: string): string | null {
  return (
    part.headers.find(
      (header) => header.name.toLowerCase() === name.toLowerCase(),
    )?.value ?? null
  );
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function plainTextBody(part: GmailMessagePart): string | null {
  if (part.mimeType === "text/plain" && part.body?.data !== undefined) {
    return decodeBase64Url(part.body.data);
  }

  for (const child of part.parts ?? []) {
    const body = plainTextBody(child);
    if (body !== null) {
      return body;
    }
  }

  if (part.body?.data !== undefined) {
    return decodeBase64Url(part.body.data);
  }

  return null;
}

function senderFromHeader(value: string | null): {
  readonly name: string;
  readonly address: string;
} {
  if (value === null) {
    return { name: "Unknown sender", address: "unknown@example.invalid" };
  }

  const angleAddress = value.match(/^(.*?)\s*<([^<>]+)>$/);
  if (angleAddress?.[2] !== undefined) {
    const address = angleAddress[2].trim();
    const name = angleAddress[1]?.replace(/^['"]|['"]$/g, "").trim();
    return { name: name || address, address };
  }

  return { name: value.trim(), address: value.trim() };
}

function safeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodedMessage(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function createGoogleOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export class GmailOAuthClient
  implements ReadOnlyMailSurface, CustomerMailAdapter
{
  readonly id = "gmail-oauth";
  readonly label = "Gmail via OAuth";
  readonly targetLabel = "Gmail authorized sender";
  readonly #configuration: GmailOAuthConfiguration;
  readonly #tokenStore: GoogleTokenStore;

  constructor(configuration: GmailOAuthConfiguration) {
    this.#configuration = configuration;
    this.#tokenStore = configuration.tokenStore ?? new LocalGoogleTokenStore();
  }

  authorizationUrl(state: string): string {
    const parameters = new URLSearchParams({
      client_id: this.#configuration.clientId,
      redirect_uri: this.#configuration.redirectUri,
      response_type: "code",
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ].join(" "),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`;
  }

  async exchangeCode(code: string): Promise<void> {
    const previous = await this.#tokenStore.read();
    const response = await fetchJsonWithTimeout(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: this.#configuration.clientId,
          client_secret: this.#configuration.clientSecret,
          redirect_uri: this.#configuration.redirectUri,
          grant_type: "authorization_code",
        }).toString(),
        timeoutMs: 8_000,
        fetchImplementation: this.#configuration.fetchImplementation,
      },
    );
    const token = tokenResponseSchema.parse(response);
    await this.#tokenStore.write({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? previous?.refreshToken ?? null,
      expiresAt: Date.now() + token.expires_in * 1_000,
      scope: token.scope ?? null,
    });
  }

  async isConnected(): Promise<boolean> {
    return (await this.#tokenStore.read()) !== null;
  }

  async #accessToken(): Promise<string> {
    const stored = await this.#tokenStore.read();
    if (stored === null) {
      throw new Error("Gmail OAuth is not connected.");
    }

    if (stored.expiresAt > Date.now() + 60_000) {
      return stored.accessToken;
    }

    if (stored.refreshToken === null) {
      throw new Error("Gmail OAuth access expired without a refresh token.");
    }

    const response = await fetchJsonWithTimeout(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.#configuration.clientId,
          client_secret: this.#configuration.clientSecret,
          refresh_token: stored.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
        timeoutMs: 8_000,
        fetchImplementation: this.#configuration.fetchImplementation,
      },
    );
    const refreshed = tokenResponseSchema.parse(response);
    const nextToken: StoredGoogleToken = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? stored.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1_000,
      scope: refreshed.scope ?? stored.scope,
    };
    await this.#tokenStore.write(nextToken);
    return nextToken.accessToken;
  }

  async #gmailRequest(path: string, init: RequestInit = {}): Promise<unknown> {
    const accessToken = await this.#accessToken();
    return fetchJsonWithTimeout(
      `https://gmail.googleapis.com/gmail/v1${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        timeoutMs: 8_000,
        fetchImplementation: this.#configuration.fetchImplementation,
      },
    );
  }

  async #getMessage(messageId: string) {
    return gmailMessageSchema.parse(
      await this.#gmailRequest(
        `/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
      ),
    );
  }

  async listRecentMessages(): Promise<MailSurfaceResult> {
    const parameters = new URLSearchParams({ maxResults: "20" });
    const query = this.#configuration.query?.trim();
    if (query !== undefined && query.length > 0) {
      parameters.set("q", query);
    }

    const listed = messageListSchema.parse(
      await this.#gmailRequest(`/users/me/messages?${parameters.toString()}`),
    );
    const messages = await Promise.all(
      listed.messages.slice(0, 20).map(async (reference) => {
        const message = await this.#getMessage(reference.id);
        const sender = senderFromHeader(headerValue(message.payload, "From"));
        const receivedAt = new Date(
          Number(message.internalDate ?? "0"),
        ).toISOString();
        return {
          id: message.id,
          threadId: message.threadId ?? reference.threadId ?? null,
          receivedAt,
          subject: (
            headerValue(message.payload, "Subject") ?? "No subject"
          ).slice(0, 300),
          body: (plainTextBody(message.payload) ?? message.snippet).slice(
            0,
            20_000,
          ),
          senderName: sender.name.slice(0, 200),
          senderAddress: sender.address.slice(0, 320),
          isRead: !message.labelIds.includes("UNREAD"),
        } satisfies ConnectedMailMessage;
      }),
    );

    return {
      provider: "gmail-oauth",
      account: this.#configuration.address ?? "Connected Google account",
      messages,
    };
  }

  async sendCustomerReply(input: CustomerReplyInput) {
    const startedAt = performance.now();
    try {
      const original = await this.#getMessage(input.originatingMessageId);
      const originalMessageId = headerValue(original.payload, "Message-ID");
      const subject =
        headerValue(original.payload, "Subject") ?? "Support request";
      const headers = [
        `To: ${safeHeaderValue(input.recipient)}`,
        `Subject: ${safeHeaderValue(subject.startsWith("Re:") ? subject : `Re: ${subject}`)}`,
        "Content-Type: text/plain; charset=UTF-8",
        "MIME-Version: 1.0",
        ...(originalMessageId === null
          ? []
          : [
              `In-Reply-To: ${safeHeaderValue(originalMessageId)}`,
              `References: ${safeHeaderValue(originalMessageId)}`,
            ]),
      ];
      const raw = encodedMessage(
        `${headers.join("\r\n")}\r\n\r\n${input.message}`,
      );
      const response = sendResponseSchema.parse(
        await this.#gmailRequest("/users/me/messages/send", {
          method: "POST",
          body: JSON.stringify({ raw, threadId: original.threadId }),
        }),
      );
      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Sent an authorized Gmail reply to ${input.recipient}.`,
        {
          deliveryId: response.id,
          destination: input.recipient,
        },
        response.id,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "gmail_reply_failed",
        "Gmail did not confirm customer-reply delivery.",
        true,
      );
    }
  }
}
