import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverEnvironment } from "../../../../config/server-env.ts";
import { createLiveAdapterSelection } from "../../../../infrastructure/adapters/live/adapter-factory.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const oauthCallbackSchema = z
  .object({
    code: z.string().trim().min(1).max(4_096).optional(),
    state: z.string().trim().min(1).max(512).optional(),
    error: z.string().trim().min(1).max(160).optional(),
  })
  .passthrough();

function workspaceRedirect(request: NextRequest, status: string): NextResponse {
  const target = new URL("/workspace", request.url);
  target.searchParams.set("mail", status);
  const response = NextResponse.redirect(target);
  response.cookies.delete("rehearsal_google_oauth_state");
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  const query = oauthCallbackSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!query.success) {
    return workspaceRedirect(request, "invalid-request");
  }

  if (query.data.error !== undefined) {
    return workspaceRedirect(request, "denied");
  }

  const { code, state } = query.data;
  const expectedState = request.cookies.get(
    "rehearsal_google_oauth_state",
  )?.value;
  if (
    code === undefined ||
    state === undefined ||
    expectedState === undefined ||
    state !== expectedState
  ) {
    return workspaceRedirect(request, "invalid-state");
  }

  const selection = await createLiveAdapterSelection(serverEnvironment);
  if (selection.oauthClient === null) {
    return workspaceRedirect(request, "not-configured");
  }

  try {
    await selection.oauthClient.exchangeCode(code);
    return workspaceRedirect(request, "connected");
  } catch {
    return workspaceRedirect(request, "failed");
  }
}
