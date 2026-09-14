import { z } from "zod";

import {
  commaSeparatedValues,
  type ServerEnvironment,
} from "../../config/environment-schema.ts";
import {
  fetchJsonWithTimeout,
  NetworkRequestError,
  type FetchImplementation,
} from "../http/index.ts";

const completionResponseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) }),
      }),
    )
    .min(1),
});

export type ModelProvider = "openrouter" | "openai" | "gemini";

export interface ModelProviderMetadata {
  readonly provider: ModelProvider;
  readonly requestedModel: string;
  readonly responseModel: string | null;
  readonly fallbackModels: readonly string[];
  readonly durationMs: number;
}

export interface JsonCompletionResult {
  readonly value: unknown;
  readonly metadata: ModelProviderMetadata;
}

export interface JsonCompletionInput {
  readonly system: string;
  readonly user: string;
  readonly signal?: AbortSignal;
}

export interface JsonModelClient {
  readonly configured: boolean;
  readonly provider: ModelProvider | null;
  completeJson(input: JsonCompletionInput): Promise<JsonCompletionResult>;
}

interface ProviderConfiguration {
  readonly provider: ModelProvider;
  readonly apiKey: string;
  readonly model: string;
  readonly endpoint: string;
  readonly fallbackModels: readonly string[];
  readonly headers: Readonly<Record<string, string>>;
}

export class ModelClientError extends Error {
  readonly code:
    | "not_configured"
    | "request_failed"
    | "invalid_provider_response"
    | "invalid_model_json";
  readonly provider: ModelProvider | null;
  readonly retryable: boolean;

  constructor(
    code: ModelClientError["code"],
    message: string,
    options: {
      readonly provider?: ModelProvider;
      readonly retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "ModelClientError";
    this.code = code;
    this.provider = options.provider ?? null;
    this.retryable = options.retryable ?? false;
  }
}

function providerConfiguration(
  environment: ServerEnvironment,
): ProviderConfiguration | null {
  if (environment.OPENROUTER_API_KEY !== undefined) {
    return {
      provider: "openrouter",
      apiKey: environment.OPENROUTER_API_KEY,
      model: environment.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      fallbackModels: commaSeparatedValues(
        environment.OPENROUTER_FALLBACK_MODELS,
      ),
      headers: {
        ...(environment.OPENROUTER_SITE_URL === undefined
          ? {}
          : { "HTTP-Referer": environment.OPENROUTER_SITE_URL }),
        "X-Title": "Rehearsal",
      },
    };
  }

  if (environment.OPENAI_API_KEY !== undefined) {
    return {
      provider: "openai",
      apiKey: environment.OPENAI_API_KEY,
      model: environment.OPENAI_MODEL ?? "gpt-4.1-mini",
      endpoint: "https://api.openai.com/v1/chat/completions",
      fallbackModels: [],
      headers: {},
    };
  }

  if (environment.GEMINI_API_KEY !== undefined) {
    return {
      provider: "gemini",
      apiKey: environment.GEMINI_API_KEY,
      model: environment.GEMINI_MODEL ?? "gemini-2.5-flash",
      endpoint:
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      fallbackModels: [],
      headers: {},
    };
  }

  return null;
}

export class OpenAICompatibleJsonClient implements JsonModelClient {
  readonly #configuration: ProviderConfiguration | null;
  readonly #fetchImplementation: FetchImplementation;

  constructor(
    environment: ServerEnvironment,
    fetchImplementation: FetchImplementation = fetch,
  ) {
    this.#configuration = providerConfiguration(environment);
    this.#fetchImplementation = fetchImplementation;
  }

  get configured(): boolean {
    return this.#configuration !== null;
  }

  get provider(): ModelProvider | null {
    return this.#configuration?.provider ?? null;
  }

  async completeJson(
    input: JsonCompletionInput,
  ): Promise<JsonCompletionResult> {
    const configuration = this.#configuration;
    if (configuration === null) {
      throw new ModelClientError(
        "not_configured",
        "No supported model provider is configured.",
      );
    }

    const startedAt = performance.now();
    const models = [configuration.model, ...configuration.fallbackModels];
    const body = {
      model: configuration.model,
      ...(configuration.fallbackModels.length === 0 ? {} : { models }),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    };

    let response: unknown;
    try {
      response = await fetchJsonWithTimeout(configuration.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          "Content-Type": "application/json",
          ...configuration.headers,
        },
        body: JSON.stringify(body),
        timeoutMs: 8_000,
        fetchImplementation: this.#fetchImplementation,
        signal: input.signal,
      });
    } catch (error) {
      throw new ModelClientError(
        "request_failed",
        "The configured model provider could not complete the request.",
        {
          provider: configuration.provider,
          retryable:
            error instanceof NetworkRequestError ? error.retryable : false,
        },
      );
    }

    const parsedResponse = completionResponseSchema.safeParse(response);
    if (!parsedResponse.success) {
      throw new ModelClientError(
        "invalid_provider_response",
        "The model provider returned an unexpected response shape.",
        { provider: configuration.provider },
      );
    }

    const content = parsedResponse.data.choices[0]?.message.content;
    if (content === undefined) {
      throw new ModelClientError(
        "invalid_provider_response",
        "The model provider returned no completion content.",
        { provider: configuration.provider },
      );
    }

    let value: unknown;
    try {
      value = JSON.parse(content);
    } catch {
      throw new ModelClientError(
        "invalid_model_json",
        "The model completion was not valid JSON.",
        { provider: configuration.provider },
      );
    }

    return {
      value,
      metadata: {
        provider: configuration.provider,
        requestedModel: configuration.model,
        responseModel: parsedResponse.data.model ?? null,
        fallbackModels: configuration.fallbackModels,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      },
    };
  }
}
