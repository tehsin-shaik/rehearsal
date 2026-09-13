import { z } from "zod";
import { jsonMap, selectedTracker, type Environment } from "../../config/environment.ts";
import type { ExecutionAdapter, TrackerIssue } from "../../domain/runs/ports.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import { requestJson, jsonRequest, IntegrationError, type HttpClient } from "../api-clients/http.ts";

const idSchema=z.object({id:z.union([z.string(),z.number()]),url:z.string().url().optional()});
const githubIssue=z.object({number:z.number(),html_url:z.string().url(),title:z.string(),body:z.string().nullable().optional(),labels:z.array(z.union([z.string(),z.object({name:z.string()})])).default([]),assignee:z.object({login:z.string()}).nullable().optional()});
function required(value:string|undefined,name:string):string {if(!value)throw new IntegrationError("NOT_CONFIGURED",`${name} is not configured.`);return value;}
function segment(value:unknown):string{return encodeURIComponent(String(value));}
export function jiraDocument(text:string) {return {type:"doc",version:1,content:text.split("\n").map(line=>({type:"paragraph",content:line?[{type:"text",text:line}]:[]}))};}
function jiraRoot(env:Environment):string {const url=new URL(required(env.JIRA_BASE_URL,"Jira site"));if(url.protocol!=="https:"||!url.hostname.endsWith(".atlassian.net"))throw new IntegrationError("INVALID_SITE","Jira Cloud requires an HTTPS atlassian.net site.");return url.origin;}
function githubRepo(env:Environment):string {const repo=required(env.GITHUB_REPO,"GitHub repository");if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw new IntegrationError("INVALID_REPOSITORY","Use owner/repository for GitHub.");return repo;}

export function configuredOwner(env:Environment,owner:string):string|undefined {const tracker=selectedTracker(env);return jsonMap(tracker==="github"?env.GITHUB_ASSIGNEES:tracker==="clickup"?env.CLICKUP_ASSIGNEES:env.JIRA_ASSIGNEES)[owner];}
export function trackerDestination(env:Environment):string {
  const tracker=selectedTracker(env);
  if(tracker==="github")return `GitHub · ${githubRepo(env)}`;
  if(tracker==="clickup")return `ClickUp · list ${required(env.CLICKUP_LIST_ID,"ClickUp list")}`;
  if(tracker==="jira")return `Jira · ${jiraRoot(env)} · ${required(env.JIRA_PROJECT_KEY,"Jira project")}`;
  if(tracker==="ambiguous")throw new IntegrationError("CONTRACT_UNAVAILABLE","Ambiguous is unavailable until its API contract is verified. Choose GitHub, ClickUp, or Jira.");
  throw new IntegrationError("NOT_CONFIGURED","Choose and configure an issue tracker.");
}

export class TrackerAdapter implements ExecutionAdapter {
  readonly name:string; readonly #env:Environment; readonly #client:HttpClient;
  constructor(env:Environment,client:HttpClient=fetch){this.#env=env;this.#client=client;this.name=selectedTracker(env)??"unconfigured-tracker";}
  async perform(action:PlannedAction) {
    const env=this.#env,p=action.resolvedInput;
    if(this.name==="github") {
      const root=`https://api.github.com/repos/${githubRepo(env)}`; const headers={Authorization:`Bearer ${required(env.GITHUB_TOKEN,"GitHub token")}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
      if(action.action==="create_issue") {
        const raw=await requestJson(`${root}/issues`,jsonRequest("POST",{title:p.title,body:p.description,labels:p.labels},headers),this.#client);
        const issue=githubIssue.parse(raw);return {status:"succeeded" as const,externalReference:String(issue.number),externalUrl:issue.html_url};
      }
      const owner=required(String(p.externalOwnerId??configuredOwner(env,String(p.owner))??""),"GitHub assignee mapping");
      await requestJson(`${root}/issues/${segment(p.issueReference)}/assignees`,jsonRequest("POST",{assignees:[owner]},headers),this.#client);
      const issue=githubIssue.parse(await requestJson(`${root}/issues/${segment(p.issueReference)}`,{headers},this.#client));
      const raw=await requestJson(`${root}/issues/${segment(p.issueReference)}`,{headers},this.#client);
      const assignees=z.object({assignees:z.array(z.object({login:z.string()}))}).parse(raw).assignees;
      if(!assignees.some(a=>a.login.toLowerCase()===owner.toLowerCase()))throw new IntegrationError("ASSIGNMENT_NOT_VERIFIED","GitHub did not confirm the requested assignee.");
      return {status:"succeeded" as const,externalReference:String(issue.number),externalUrl:issue.html_url};
    }
    if(this.name==="clickup") {
      const headers={Authorization:required(env.CLICKUP_API_KEY,"ClickUp API key")};
      if(action.action==="create_issue") {
        const raw=await requestJson(`https://api.clickup.com/api/v2/list/${segment(required(env.CLICKUP_LIST_ID,"ClickUp list"))}/task`,jsonRequest("POST",{name:p.title,markdown_content:p.description,tags:p.labels,priority:p.severity==="high"?2:p.severity==="medium"?3:4,check_required_custom_fields:true},headers),this.#client);
        const issue=idSchema.extend({url:z.string().url()}).parse(raw);return {status:"succeeded" as const,externalReference:String(issue.id),externalUrl:issue.url};
      }
      const owner=Number(p.externalOwnerId??configuredOwner(env,String(p.owner)));if(!Number.isSafeInteger(owner)||owner<1)throw new IntegrationError("INVALID_ASSIGNEE","Configure a numeric ClickUp owner ID.");
      const url=`https://api.clickup.com/api/v2/task/${segment(p.issueReference)}`;
      await requestJson(url,jsonRequest("PUT",{assignees:{add:[owner],rem:[]}},headers),this.#client);
      const confirmed=z.object({id:z.string(),url:z.string().url(),assignees:z.array(z.object({id:z.number()}))}).parse(await requestJson(url,{headers},this.#client));
      if(!confirmed.assignees.some(a=>a.id===owner))throw new IntegrationError("ASSIGNMENT_NOT_VERIFIED","ClickUp did not confirm assignment.");
      return {status:"succeeded" as const,externalReference:confirmed.id,externalUrl:confirmed.url};
    }
    if(this.name==="jira") {
      const root=jiraRoot(env); const headers={Authorization:`Basic ${Buffer.from(`${required(env.JIRA_EMAIL,"Jira email")}:${required(env.JIRA_API_TOKEN,"Jira API token")}`).toString("base64")}`,Accept:"application/json"};
      if(action.action==="create_issue") {
        const metadata=z.object({issueTypes:z.array(z.object({id:z.string(),name:z.string()}))}).parse(await requestJson(`${root}/rest/api/3/issue/createmeta/${segment(required(env.JIRA_PROJECT_KEY,"Jira project"))}/issuetypes`,{headers},this.#client));
        const type=metadata.issueTypes.find(t=>t.name===env.JIRA_ISSUE_TYPE||t.id===env.JIRA_ISSUE_TYPE);if(!type)throw new IntegrationError("ISSUE_TYPE_UNAVAILABLE","The configured Jira issue type is not available.");
        const raw=await requestJson(`${root}/rest/api/3/issue`,jsonRequest("POST",{fields:{project:{key:env.JIRA_PROJECT_KEY},issuetype:{id:type.id},summary:p.title,description:jiraDocument(String(p.description)),labels:p.labels}},headers),this.#client);
        const issue=z.object({id:z.string(),key:z.string()}).parse(raw);return {status:"succeeded" as const,externalReference:issue.key,externalUrl:`${root}/browse/${segment(issue.key)}`};
      }
      const accountId=required(String(p.externalOwnerId??configuredOwner(env,String(p.owner))??""),"Jira account ID mapping");
      await requestJson(`${root}/rest/api/3/issue/${segment(p.issueReference)}/assignee`,jsonRequest("PUT",{accountId},headers),this.#client);
      const confirmed=z.object({key:z.string(),fields:z.object({assignee:z.object({accountId:z.string()}).nullable()})}).parse(await requestJson(`${root}/rest/api/3/issue/${segment(p.issueReference)}?fields=assignee`,{headers},this.#client));
      if(confirmed.fields.assignee?.accountId!==accountId)throw new IntegrationError("ASSIGNMENT_NOT_VERIFIED","Jira did not confirm the requested assignee.");
      return {status:"succeeded" as const,externalReference:confirmed.key,externalUrl:`${root}/browse/${segment(confirmed.key)}`};
    }
    throw new IntegrationError("NOT_CONFIGURED","The tracker adapter is not configured.");
  }
  async list():Promise<TrackerIssue[]> {
    const env=this.#env;
    if(this.name==="github") {
      const raw=await requestJson(`https://api.github.com/repos/${githubRepo(env)}/issues?state=open&per_page=20`,{headers:{Authorization:`Bearer ${required(env.GITHUB_TOKEN,"GitHub token")}`,Accept:"application/vnd.github+json"}},this.#client);
      return z.array(githubIssue.extend({pull_request:z.unknown().optional()})).parse(raw).filter(i=>!i.pull_request).map(i=>({id:String(i.number),url:i.html_url,title:i.title,description:i.body??"",labels:i.labels.map(l=>typeof l==="string"?l:l.name),severity:"medium",owner:i.assignee?.login??null,department:"unresolved"}));
    }
    if(this.name==="clickup") {
      const raw=await requestJson(`https://api.clickup.com/api/v2/list/${segment(required(env.CLICKUP_LIST_ID,"ClickUp list"))}/task?page=0`,{headers:{Authorization:required(env.CLICKUP_API_KEY,"ClickUp API key")}},this.#client);
      return z.object({tasks:z.array(z.object({id:z.string(),url:z.string().url(),name:z.string(),description:z.string().optional(),tags:z.array(z.object({name:z.string()})).default([]),assignees:z.array(z.object({username:z.string()})).default([])}))}).parse(raw).tasks.slice(0,20).map(i=>({id:i.id,url:i.url,title:i.name,description:i.description??"",labels:i.tags.map(t=>t.name),severity:"medium",owner:i.assignees[0]?.username??null,department:"unresolved"}));
    }
    if(this.name==="jira") {
      const project=required(env.JIRA_PROJECT_KEY,"Jira project");if(!/^[A-Z][A-Z0-9_]+$/.test(project))throw new IntegrationError("INVALID_PROJECT","Invalid Jira project key.");
      const root=jiraRoot(env);const raw=await requestJson(`${root}/rest/api/3/search/jql`,jsonRequest("POST",{jql:`project = "${project}" ORDER BY created DESC`,maxResults:20,fields:["summary","labels","assignee"]},{Authorization:`Basic ${Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString("base64")}`}),this.#client);
      return z.object({issues:z.array(z.object({key:z.string(),fields:z.object({summary:z.string(),labels:z.array(z.string()),assignee:z.object({displayName:z.string()}).nullable()})}))}).parse(raw).issues.map(i=>({id:i.key,url:`${root}/browse/${i.key}`,title:i.fields.summary,description:"",labels:i.fields.labels,severity:"medium",owner:i.fields.assignee?.displayName??null,department:"unresolved"}));
    }
    return [];
  }
}
