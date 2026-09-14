"use client";

import {
  useRehearsalApplication,
  useRehearsalState,
} from "../providers/rehearsal-provider";
import { Icon } from "../ui/icon";
import {
  Avatar,
  Badge,
  Button,
  GuideRing,
  WindowFrame,
  cx,
} from "../ui/primitives";

function compactTime(timestamp: string): string {
  return timestamp.slice(11, 16);
}

export function ChatReplica() {
  const { commands } = useRehearsalApplication();
  const workspace = useRehearsalState((state) => state.workspace);
  const integration = useRehearsalState((state) => state.integration);
  const phase = useRehearsalState((state) => state.engine.phase);
  const messages = workspace.teamMessages.filter(
    (message) => message.channel === workspace.activeChannel,
  );

  return (
    <WindowFrame
      action={
        <Badge tone={integration.mode === "demo" ? "teal" : "cyan"}>
          {integration.messagingTarget.includes("Demo")
            ? "Replica"
            : integration.messagingTarget}
        </Badge>
      }
      icon="users"
      identity="Team chat"
      title={workspace.activeChannel}
    >
      <div className="chat-layout">
        <nav className="channel-list" aria-label="Team channels">
          <span className="channel-list__label">Channels</span>
          {workspace.teamChannels.map((channel) => (
            <button
              className={cx(
                "channel-button",
                channel.id === workspace.activeChannel && "is-active",
              )}
              key={channel.id}
              onClick={() => commands.openTeamChannel(channel.id)}
              type="button"
            >
              # {channel.label}
            </button>
          ))}
        </nav>
        <div className="chat-main">
          <header className="chat-header">{workspace.activeChannel}</header>
          <div className="chat-messages">
            {messages.map((message) => (
              <article
                className={cx(
                  "chat-message",
                  message.source === "agent" && "is-agent",
                )}
                key={message.id}
              >
                <Avatar
                  agent={message.source === "agent"}
                  name={message.author}
                />
                <div>
                  <span className="chat-message__author">
                    {message.author}
                    <time className="chat-message__time">
                      {compactTime(message.sentAt)}
                    </time>
                  </span>
                  <p className="chat-message__body">{message.message}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="chat-composer">
            <input
              aria-label="Team notification draft"
              className="input"
              onChange={(event) =>
                commands.draftNotification(event.target.value)
              }
              placeholder="Draft team notification"
              value={workspace.teamMessageDraft}
            />
            {workspace.teamMessageDraft ? (
              <GuideRing active={phase === "observing"}>
                <Button
                  compact
                  onClick={() => commands.sendNotificationManually()}
                  variant="primary"
                >
                  <Icon name="send" size={11} /> Send
                </Button>
              </GuideRing>
            ) : (
              <Button
                compact
                disabled={workspace.structuredUnderstanding === null}
                onClick={() => commands.draftNotification()}
                variant="ghost"
              >
                Draft
              </Button>
            )}
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}
