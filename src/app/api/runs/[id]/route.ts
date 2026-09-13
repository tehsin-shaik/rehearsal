import { z } from "zod";
import { environment } from "@/config/environment";
import { approveRun } from "@/domain/runs/planner";
import { apiBoundary,requestBody,requireSession,validateOrigin,ApiError } from "@/infrastructure/persistence/server-state";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return apiBoundary(async()=>{const env=environment();validateOrigin(request,env);const session=requireSession(request,env);const {id}=await params;const run=session.runs.get(id);if(!run)throw new ApiError(404,"Run not found in this session.");const input=z.object({intent:z.enum(["approve","cancel"])}).strict().parse(await requestBody(request));if(run.status==="executing")throw new ApiError(409,"Execution is already in progress.");if(input.intent==="cancel"&&run.status==="completed")throw new ApiError(409,"A completed run cannot be cancelled.");const updated=input.intent==="approve"?approveRun(run,`session:${session.id.slice(0,12)}`):{...run,status:"cancelled" as const};session.runs.set(id,updated);return Response.json(updated,{headers:{"Cache-Control":"no-store"}});});}
