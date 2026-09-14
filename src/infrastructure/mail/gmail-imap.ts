import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import type {
  ConnectedMailMessage,
  MailSurfaceResult,
  ReadOnlyMailSurface,
} from "./mail-surface.ts";

export interface GmailImapConfiguration {
  readonly address: string;
  readonly appPassword: string;
  readonly query?: string;
}

function normalizedDate(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? 0);
  return Number.isNaN(date.getTime())
    ? "1970-01-01T00:00:00.000Z"
    : date.toISOString();
}

export class GmailImapSurface implements ReadOnlyMailSurface {
  readonly id = "gmail-imap";
  readonly label = "Gmail via read-only IMAP";
  readonly #configuration: GmailImapConfiguration;

  constructor(configuration: GmailImapConfiguration) {
    this.#configuration = configuration;
  }

  async listRecentMessages(): Promise<MailSurfaceResult> {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: this.#configuration.address,
        pass: this.#configuration.appPassword,
      },
      logger: false,
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
    });

    try {
      await client.connect();
      const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
      const query = this.#configuration.query?.trim();
      const identifiers =
        query === undefined || query.length === 0
          ? null
          : await client.search({ gmailraw: query }, { uid: true });
      const range =
        identifiers === null
          ? mailbox.exists === 0
            ? []
            : `${Math.max(1, mailbox.exists - 19)}:*`
          : identifiers === false || identifiers === undefined
            ? []
            : identifiers.slice(-20);
      if (Array.isArray(range) && range.length === 0) {
        return {
          provider: "gmail-imap",
          account: this.#configuration.address,
          messages: [],
        };
      }

      const fetched = await client.fetchAll(
        range,
        {
          uid: true,
          flags: true,
          envelope: true,
          internalDate: true,
          threadId: true,
          source: { maxLength: 750_000 },
        },
        identifiers === null ? {} : { uid: true },
      );
      const messages: ConnectedMailMessage[] = [];
      for (const message of fetched.slice(-20).reverse()) {
        if (message.source === undefined) {
          continue;
        }

        const parsed = await simpleParser(message.source, {
          maxHtmlLengthToParse: 300_000,
          skipImageLinks: true,
        });
        const sender = parsed.from?.value[0];
        messages.push({
          id:
            message.emailId ??
            message.envelope?.messageId ??
            `gmail-imap-${message.uid}`,
          threadId: message.threadId ?? null,
          receivedAt: normalizedDate(
            message.internalDate ?? message.envelope?.date,
          ),
          subject: (
            parsed.subject ??
            message.envelope?.subject ??
            "No subject"
          ).slice(0, 300),
          body: (parsed.text ?? "").trim().slice(0, 20_000),
          senderName: (
            sender?.name ??
            sender?.address ??
            "Unknown sender"
          ).slice(0, 200),
          senderAddress: (sender?.address ?? "unknown@example.invalid").slice(
            0,
            320,
          ),
          isRead: message.flags?.has("\\Seen") ?? false,
        });
      }

      return {
        provider: "gmail-imap",
        account: this.#configuration.address,
        messages,
      };
    } finally {
      if (client.usable) {
        await client.logout().catch(() => undefined);
      }
    }
  }
}
