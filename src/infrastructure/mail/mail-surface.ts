import type { MailMessage } from "../../domain/understanding/mail-message.ts";

export interface ConnectedMailMessage extends MailMessage {
  readonly threadId: string | null;
  readonly senderName: string;
  readonly senderAddress: string;
  readonly isRead: boolean;
}

export interface MailSurfaceResult {
  readonly provider: "gmail-imap" | "gmail-oauth";
  readonly account: string;
  readonly messages: readonly ConnectedMailMessage[];
}

export interface ReadOnlyMailSurface {
  readonly id: string;
  readonly label: string;
  listRecentMessages(): Promise<MailSurfaceResult>;
}
