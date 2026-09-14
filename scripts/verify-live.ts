import assert from "node:assert/strict";

import { readServerEnvironment } from "../src/config/environment-schema.ts";
import { duplicateBillingChargeReport } from "../src/demo/fixtures/reports.ts";
import { OpenAICompatibleJsonClient } from "../src/infrastructure/ai/openai-compatible-client.ts";
import { understandReportWithModel } from "../src/infrastructure/ai/live-understanding.ts";
import { ExaResearchClient } from "../src/infrastructure/research/exa-client.ts";
import { loadLocalEnvironment } from "./load-local-environment.ts";

await loadLocalEnvironment();
const environment = readServerEnvironment(process.env);
const modelClient = new OpenAICompatibleJsonClient(environment);
const researchClient = new ExaResearchClient(environment.EXA_API_KEY);

if (!modelClient.configured && environment.EXA_API_KEY === undefined) {
  process.stdout.write(
    "SKIP live verification: no model-provider or Exa credentials are configured.\n",
  );
  process.exit(0);
}

if (modelClient.configured) {
  const result = await understandReportWithModel(
    duplicateBillingChargeReport,
    modelClient,
  );
  assert.equal(result.understanding.reportId, duplicateBillingChargeReport.id);
  if (result.provenance.fallbackReason === "model_request_failed") {
    throw new Error("The configured model provider could not be reached.");
  }
  process.stdout.write(
    `PASS model provider ${modelClient.provider ?? "configured"}; result source ${result.provenance.source}.\n`,
  );
} else {
  process.stdout.write(
    "SKIP model verification: no model provider is configured.\n",
  );
}

if (environment.EXA_API_KEY !== undefined) {
  const result = await researchClient.searchReport(
    duplicateBillingChargeReport,
  );
  if (result.status !== "completed") {
    throw new Error(
      "The configured Exa research service could not be reached.",
    );
  }
  assert.ok(result.results.length <= 3);
  assert.equal(result.query.includes("Leila Haddad"), false);
  assert.equal(result.query.includes("leila.haddad@example.test"), false);
  process.stdout.write(
    `PASS Exa privacy and response validation with ${result.results.length} result(s).\n`,
  );
} else {
  process.stdout.write(
    "SKIP Exa verification: EXA_API_KEY is not configured.\n",
  );
}
