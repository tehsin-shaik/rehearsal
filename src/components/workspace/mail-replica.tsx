"use client";

import {
  useRehearsalApplication,
  useRehearsalState,
} from "../providers/rehearsal-provider";
import { Icon } from "../ui/icon";
import {
  Badge,
  Button,
  EmptyState,
  GuideRing,
  WindowFrame,
  buttonClassName,
  cx,
} from "../ui/primitives";

function compactTime(timestamp: string): string {
  return timestamp.slice(11, 16);
}

export function MailReplica() {
  const { commands } = useRehearsalApplication();
  const workspace = useRehearsalState((state) => state.workspace);
  const engine = useRehearsalState((state) => state.engine);
  const integration = useRehearsalState((state) => state.integration);
  const selected = workspace.inboxMessages.find(
    (message) => message.id === workspace.selectedMessageId,
  );
  const mayReply =
    selected !== undefined &&
    workspace.structuredUnderstanding !== null &&
    engine.activeTrace !== null;

  return (
    <WindowFrame
      action={
        integration.mode === "live" &&
        integration.mailSurface === null &&
        integration.oauthConnectionUrl !== null ? (
          <a
            className={buttonClassName("secondary", true)}
            href={integration.oauthConnectionUrl}
          >
            Connect Gmail
          </a>
        ) : (
          <Badge tone={integration.mode === "demo" ? "teal" : "cyan"}>
            {integration.mode === "demo"
              ? "Replica"
              : (integration.mailSurface?.label ?? "Unavailable")}
          </Badge>
        )
      }
      icon="mail"
      identity="Mail"
      title="Support inbox"
    >
      <div className="mail-layout">
        <div className="mail-list">
          <div className="mail-list__heading">
            <span>Inbox</span>
            <span className="mono">
              {
                workspace.inboxMessages.filter((message) => !message.isRead)
                  .length
              }
            </span>
          </div>
          {workspace.inboxMessages.map((message) => (
            <button
              className={cx(
                "mail-item",
                !message.isRead && "is-unread",
                message.isNew && "is-new",
                selected?.id === message.id && "is-selected",
              )}
              key={message.id}
              onClick={() => commands.readMail(message.id)}
              type="button"
            >
              <span className="mail-item__dot" />
              <span className="mail-item__content">
                <span className="mail-item__top">
                  <span className="mail-item__sender">
                    {message.senderName}
                  </span>
                  <time className="mail-item__time">
                    {compactTime(message.receivedAt)}
                  </time>
                </span>
                <span className="mail-item__subject">{message.subject}</span>
                <span className="mail-item__preview">{message.preview}</span>
              </span>
            </button>
          ))}
        </div>

        {selected === undefined ? (
          <EmptyState
            detail="Choose a message to inspect its semantic intent."
            icon="inbox"
            title="Select a message"
          />
        ) : (
          <article className="mail-detail">
            <header className="mail-detail__header">
              <div>
                <h3>{selected.subject}</h3>
                <span className="mail-detail__sender">
                  {selected.senderName} · {selected.senderAddress}
                </span>
              </div>
              {selected.isSupportLike ? (
                <Badge tone="cyan">support-like</Badge>
              ) : (
                <Badge>ordinary mail</Badge>
              )}
            </header>
            <div className="mail-detail__body">{selected.body}</div>
            <div className="mail-detail__actions">
              <GuideRing
                active={
                  engine.phase === "idle" &&
                  selected.isSupportLike &&
                  engine.completedTraces.length < 2
                }
              >
                <Button
                  compact
                  onClick={() => commands.readMail(selected.id)}
                  variant="secondary"
                >
                  <Icon name="eye" size={12} /> Read
                </Button>
              </GuideRing>
              <Button
                compact
                disabled={engine.activeTrace === null}
                onClick={() => commands.copyReportMetadata()}
                variant="ghost"
              >
                <Icon name="copy" size={12} /> Inspect
              </Button>
              <Button
                compact
                disabled={!mayReply}
                onClick={() => void commands.replyToCustomerManually()}
                variant="ghost"
              >
                <Icon name="mail" size={12} /> Reply
              </Button>
            </div>
          </article>
        )}
      </div>
    </WindowFrame>
  );
}
