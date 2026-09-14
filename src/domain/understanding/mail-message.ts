export interface MailMessage {
  readonly id: string;
  readonly receivedAt: string;
  readonly subject: string;
  readonly body: string;
}
