import type { Environment } from "../../config/environment.ts";
import { jsonMap } from "../../config/environment.ts";
import type { ExecutionAdapter } from "../../domain/runs/ports.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import { IntegrationError, type HttpClient } from "../api-clients/http.ts";
export function slackWebhook(env:Environment,channel:string):string {
  // Incoming webhooks are bound to a channel. Never pretend a payload override reroutes them.
  const webhook=jsonMap(env.SLACK_AREA_WEBHOOKS)[channel]??(jsonMap(env.NEXT_PUBLIC_SLACK_AREA_CHANNELS).default===channel?env.SLACK_WEBHOOK_URL:undefined);
  if(!webhook)throw new IntegrationError("CHANNEL_NOT_CONFIGURED",`Configure a Slack webhook for #${channel}.`);
  const url=new URL(webhook);if(url.protocol!=="https:"||!['hooks.slack.com','hooks.slack-gov.com'].includes(url.hostname))throw new IntegrationError("INVALID_WEBHOOK","Use an official Slack incoming webhook.");return webhook;
}
export class SlackAdapter implements ExecutionAdapter {
  readonly name="slack"; readonly #env:Environment; readonly #client:HttpClient;
  constructor(env:Environment,client:HttpClient=fetch){this.#env=env;this.#client=client;}
  async perform(action:PlannedAction){const p=action.resolvedInput;const text=String(p.text)+(p.issueUrl?`\n${p.issueUrl}`:"");const response=await this.#client(slackWebhook(this.#env,String(p.channel)),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text}),signal:AbortSignal.timeout(8000),redirect:"error"});if(!response.ok||await response.text()!=="ok")throw new IntegrationError("SLACK_NOT_CONFIRMED","Slack did not confirm delivery.");return {status:"succeeded" as const,externalReference:`slack:${action.idempotencyKey}`};}
}
