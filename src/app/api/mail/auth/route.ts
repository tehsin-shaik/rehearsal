import { NextResponse } from "next/server";

import { serverEnvironment } from "../../../../config/server-env.ts";
import { createLiveAdapterSelection } from "../../../../infrastructure/adapters/live/adapter-factory.ts";
import { createGoogleOAuthState } from "../../../../infrastructure/mail/gmail-oauth.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (serverEnvironment.DEMO_MODE) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "demo_mode_oauth_disabled",
          message: "OAuth connection is disabled while Demo Mode is active.",
        },
      },
      { status: 409 },
    );
  }

  const selection = await createLiveAdapterSelection(serverEnvironment);
  if (selection.oauthClient === null) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "oauth_not_configured",
          message: "Google OAuth credentials are not configured.",
        },
      },
      { status: 503 },
    );
  }

  const state = createGoogleOAuthState();
  const response = NextResponse.redirect(
    selection.oauthClient.authorizationUrl(state),
  );
  response.cookies.set("rehearsal_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    maxAge: 600,
    path: "/",
  });
  return response;
}
