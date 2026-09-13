import type { AgentRun } from "../../domain/runs/agent-run.ts";
import { z } from "zod";
export async function localApi<T>(path:string,body?:unknown):Promise<T>{const response=await fetch(path,{method:body===undefined?"GET":"POST",headers:body===undefined?{}:{"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();if(!response.ok)throw new Error(z.object({error:z.string()}).parse(data).error);return data as T;}
export async function executeRemotePlan(run:AgentRun,onProgress:(run:AgentRun)=>void):Promise<AgentRun>{
  let current=run.approval.status==="approved"?run:await localApi<AgentRun>(`/api/runs/${encodeURIComponent(run.id)}`,{intent:"approve"});
  for(const action of current.plannedActions){if(current.results.some(r=>r.actionId===action.id&&r.status==="succeeded"))continue;const result=await localApi<{run:AgentRun}>("/api/execute",{runId:current.id,actionId:action.id});current=result.run;onProgress(current);if(current.status==="failed"||current.status==="needs_review")break;}
  return current;
}
