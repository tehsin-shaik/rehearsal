import type { AgentRun } from "../../domain/runs/agent-run.ts";
export function planningEvents(run:AgentRun,threadId:string) {
  const events:Record<string,unknown>[]=[{type:"RUN_STARTED",threadId,runId:run.id}];
  for(const action of run.plannedActions){events.push({type:"TOOL_CALL_START",toolCallId:action.id,toolCallName:"proposeAction"},{type:"TOOL_CALL_ARGS",toolCallId:action.id,delta:JSON.stringify(action)},{type:"TOOL_CALL_END",toolCallId:action.id});}
  events.push({type:"TOOL_CALL_START",toolCallId:`${run.id}-plan`,toolCallName:"proposeRun"},{type:"TOOL_CALL_ARGS",toolCallId:`${run.id}-plan`,delta:JSON.stringify(run)},{type:"TOOL_CALL_END",toolCallId:`${run.id}-plan`},{type:"STATE_SNAPSHOT",snapshot:{run}},{type:"RUN_FINISHED",threadId,runId:run.id});
  return events;
}
export function planningStream(run:AgentRun,threadId:string):Response {
  const encoder=new TextEncoder();const events=planningEvents(run,threadId);
  return new Response(new ReadableStream({start(controller){for(const event of events)controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));controller.close();}}),{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no"}});
}
