import { environment } from "@/config/environment";
import { apiBoundary,requireSession,ApiError } from "@/infrastructure/persistence/server-state";
export const runtime="nodejs";
export async function GET(request:Request){return apiBoundary(async()=>{const env=environment();const s=requireSession(request,env);const url=new URL(request.url);if(!s.oauthState||url.searchParams.get("state")!==s.oauthState)throw new ApiError(403,"Invalid OAuth state.");s.oauthState=undefined;const code=url.searchParams.get("code");if(!code)throw new ApiError(400,"Google authorization was cancelled.");await s.mail.exchange(code);return Response.redirect(new URL("/integrations?mail=connected",env.REHEARSAL_BASE_URL));});}
