import { readServerEnvironment } from "../src/config/environment-schema.ts";
import { createLiveAdapterSelection } from "../src/infrastructure/adapters/live/adapter-factory.ts";
import { loadLocalEnvironment } from "./load-local-environment.ts";

await loadLocalEnvironment();
const environment = readServerEnvironment(process.env);
const selection = await createLiveAdapterSelection(environment);
let verifiedSurfaceCount = 0;

if (selection.mailSurface !== null) {
  const result = await selection.mailSurface.listRecentMessages();
  process.stdout.write(
    `PASS ${result.provider} read-only surface returned ${result.messages.length} recent message(s).\n`,
  );
  verifiedSurfaceCount += 1;
} else {
  process.stdout.write(
    "SKIP mail surface: Gmail IMAP or connected OAuth is not configured.\n",
  );
}

const selectedTracker = selection.trackers.find((tracker) => tracker.selected);
if (
  selectedTracker !== undefined &&
  selectedTracker.configured &&
  selection.selectedTracker !== "ambiguous_sandbox" &&
  selection.adapters.issueTracker.listRecentIssues !== undefined
) {
  const issues = await selection.adapters.issueTracker.listRecentIssues();
  process.stdout.write(
    `PASS ${selectedTracker.label} read-only surface returned ${issues.length} recent issue(s).\n`,
  );
  verifiedSurfaceCount += 1;
} else if (selection.selectedTracker === "ambiguous_sandbox") {
  process.stdout.write(
    "SKIP Ambiguous sandbox surface: sandbox creation is write-gated by verify:ambiguous.\n",
  );
} else {
  process.stdout.write(
    "SKIP tracker surface: no configured tracker exposes a read-only listing.\n",
  );
}

if (verifiedSurfaceCount === 0) {
  process.stdout.write(
    "SKIP connected surfaces: no read-only credentials are available.\n",
  );
}
