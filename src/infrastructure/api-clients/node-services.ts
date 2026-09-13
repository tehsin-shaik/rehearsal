import type { Environment } from "../../config/environment.ts";
import { IntegrationError } from "./http.ts";
/** Optional services bind only to loopback; a caller cannot supply a remote URL. */
export async function nodeService(env: Environment, path: "/mail/list" | "/mail/send", body: unknown, client: typeof fetch = fetch): Promise<unknown> {
    if (!env.REHEARSAL_BRIDGE_KEY || env.REHEARSAL_BRIDGE_KEY.length < 24)
        throw new IntegrationError("BRIDGE_NOT_CONFIGURED", "Configure the optional Node services and a strong bridge key.");
    const response = await client(`http://127.0.0.1:4001${path}`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/json", "x-rehearsal-bridge": env.REHEARSAL_BRIDGE_KEY },
        body: JSON.stringify(body),
    });
    if (!response.ok)
        throw new IntegrationError("MAIL_BRIDGE_FAILED", "The mail service did not confirm success. Check its configuration and reconcile uncertain sends.");
    return response.json();
}
