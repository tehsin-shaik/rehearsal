import { serverEnvironment } from "../../../../config/server-env.ts";
import { createLiveAdapterSelection } from "../../../../infrastructure/adapters/live/adapter-factory.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (serverEnvironment.DEMO_MODE) {
    return Response.json({
      ok: true,
      mode: "demo",
      surface: null,
      messages: [],
      fallbackToReplica: true,
      oauthConnectionUrl: null,
    });
  }

  const selection = await createLiveAdapterSelection(serverEnvironment);
  if (selection.mailSurface === null) {
    return Response.json({
      ok: true,
      mode: "live",
      surface: null,
      messages: [],
      fallbackToReplica: true,
      oauthConnectionUrl:
        selection.oauthClient === null ? null : "/api/mail/auth",
    });
  }

  try {
    const result = await selection.mailSurface.listRecentMessages();
    return Response.json({
      ok: true,
      mode: "live",
      surface: {
        id: selection.mailSurface.id,
        provider: result.provider,
        label: selection.mailSurface.label,
        status: "connected",
        externalUrl: "https://mail.google.com/",
      },
      account: result.account,
      messages: result.messages,
      fallbackToReplica: false,
      oauthConnectionUrl: null,
    });
  } catch {
    return Response.json({
      ok: true,
      mode: "live",
      surface: {
        id: selection.mailSurface.id,
        provider: selection.mailSurface.id,
        label: selection.mailSurface.label,
        status: "error",
        externalUrl: null,
      },
      messages: [],
      fallbackToReplica: true,
      oauthConnectionUrl:
        selection.oauthClient === null ? null : "/api/mail/auth",
    });
  }
}
