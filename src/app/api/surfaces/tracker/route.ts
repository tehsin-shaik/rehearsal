import { environment,isDemo } from "@/config/environment";
import { TrackerAdapter } from "@/infrastructure/adapters/trackers";
import { apiBoundary,requireSession } from "@/infrastructure/persistence/server-state";
import { existingIssues } from "@/demo/fixtures/workspace";
export const runtime="nodejs";
export async function GET(request:Request){return apiBoundary(async()=>{const env=environment();if(isDemo(env))return Response.json({mode:"demo",issues:existingIssues});requireSession(request,env);return Response.json({mode:"live",issues:await new TrackerAdapter(env).list()},{headers:{"Cache-Control":"no-store"}});});}
