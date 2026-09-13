import { randomBytes } from "node:crypto";
import { apiBoundary,requireSession,validateOrigin } from "@/infrastructure/persistence/server-state";
export const runtime="nodejs";
export async function POST(request:Request){return apiBoundary(async()=>{validateOrigin(request);const s=requireSession(request);s.observerToken=randomBytes(32).toString("hex");return Response.json({token:s.observerToken,expiresAt:s.expiresAt},{headers:{"Cache-Control":"no-store"}});});}
