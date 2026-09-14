import { z } from "zod";

import {
  fetchJsonWithTimeout,
  fetchTextWithTimeout,
  type FetchImplementation,
} from "../../http/index.ts";
import type { MessagingAdapter, TeamMessageInput } from "../contracts.ts";
import {
  failedActionResult,
  successfulActionResult,
} from "./adapter-result.ts";

const slackResponseSchema = z.object({
  ok: z.boolean(),
  ts: z.string().optional(),
  channel: z.string().optional(),
  error: z.string().optional(),
});

export interface SlackAdapterConfiguration {
  readonly webhookUrl?: string;
  readonly botToken?: string;
  readonly areaChannels?: string;
  readonly fetchImplementation?: FetchImplementation;
}

function channelMappings(
  raw: string | undefined,
): Readonly<Record<string, string>> {
  if (raw === undefined) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
  } catch {}

  return Object.fromEntries(
    raw
      .split(",")
      .map((entry) => entry.split("=", 2).map((part) => part.trim()))
      .filter(
        (entry): entry is [string, string] =>
          entry.length === 2 && entry[0].length > 0 && entry[1].length > 0,
      ),
  );
}

export class SlackMessagingAdapter implements MessagingAdapter {
  readonly id = "slack";
  readonly targetLabel: string;
  readonly #configuration: SlackAdapterConfiguration;
  readonly #channels: Readonly<Record<string, string>>;

  constructor(configuration: SlackAdapterConfiguration) {
    if (
      configuration.botToken === undefined &&
      configuration.webhookUrl === undefined
    ) {
      throw new RangeError(
        "Slack requires a bot token or incoming webhook URL.",
      );
    }

    this.#configuration = configuration;
    this.#channels = channelMappings(configuration.areaChannels);
    this.targetLabel =
      configuration.botToken === undefined
        ? "Slack incoming webhook"
        : "Slack workspace";
  }

  #resolvedChannel(channel: string): string {
    const plainChannel = channel.replace(/^#/, "");
    return this.#channels[channel] ?? this.#channels[plainChannel] ?? channel;
  }

  async #sendWithBot(input: TeamMessageInput, startedAt: number) {
    const botToken = this.#configuration.botToken;
    if (botToken === undefined) {
      throw new TypeError("Slack bot credentials are not configured.");
    }
    const channel = this.#resolvedChannel(input.channel);
    const response = await fetchJsonWithTimeout(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel, text: input.message }),
        timeoutMs: 8_000,
        fetchImplementation: this.#configuration.fetchImplementation,
      },
    );
    const parsed = slackResponseSchema.safeParse(response);
    if (!parsed.success || !parsed.data.ok || parsed.data.ts === undefined) {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "slack_rejected_message",
        "Slack did not confirm message delivery.",
        parsed.success && parsed.data.error === "ratelimited",
      );
    }

    return successfulActionResult(
      input,
      this.id,
      startedAt,
      `Sent a Slack message to ${channel}.`,
      {
        deliveryId: parsed.data.ts,
        destination: parsed.data.channel ?? channel,
      },
      parsed.data.ts,
    );
  }

  async #sendWithWebhook(input: TeamMessageInput, startedAt: number) {
    const webhookUrl = this.#configuration.webhookUrl;
    if (webhookUrl === undefined) {
      throw new TypeError("Slack webhook credentials are not configured.");
    }
    const responseText = await fetchTextWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.message }),
      timeoutMs: 8_000,
      fetchImplementation: this.#configuration.fetchImplementation,
    });
    if (responseText.trim() !== "ok") {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "slack_rejected_message",
        "Slack did not confirm incoming-webhook delivery.",
        false,
      );
    }

    return successfulActionResult(
      input,
      this.id,
      startedAt,
      "Sent a Slack message to the configured webhook channel.",
      {
        deliveryId: input.idempotencyKey,
        destination: "configured webhook channel",
      },
    );
  }

  async sendTeamMessage(input: TeamMessageInput) {
    const startedAt = performance.now();
    try {
      return this.#configuration.botToken === undefined
        ? await this.#sendWithWebhook(input, startedAt)
        : await this.#sendWithBot(input, startedAt);
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "slack_request_failed",
        "Slack could not be reached or rejected the request.",
        true,
      );
    }
  }
}
