import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  classifyReportText,
  DEPARTMENTS,
  routeDepartment,
  TEAM_ROUTING_CONFIG,
  understandReportDeterministically,
  type Department,
  type SupportReport,
} from "../../src/domain/understanding/index.ts";
import {
  ambiguousReviewReport,
  apiTimeoutReport,
  duplicateBillingChargeReport,
  loginAuthenticationReport,
} from "../../src/demo/fixtures/index.ts";

test("all canonical fixtures receive deterministic understanding", () => {
  const cases = [
    {
      report: loginAuthenticationReport,
      category: "authentication",
      department: "technical_support",
      severity: "high",
      owner: "Umar",
      reviewRequired: false,
    },
    {
      report: apiTimeoutReport,
      category: "performance",
      department: "technical_support",
      severity: "high",
      owner: "Umar",
      reviewRequired: false,
    },
    {
      report: duplicateBillingChargeReport,
      category: "data",
      department: "billing",
      severity: "medium",
      owner: "Awaiz",
      reviewRequired: false,
    },
    {
      report: ambiguousReviewReport,
      category: "unresolved",
      department: "unresolved",
      severity: "low",
      owner: null,
      reviewRequired: true,
    },
  ] as const;

  for (const expected of cases) {
    const understanding = understandReportDeterministically(expected.report);
    assert.equal(understanding.source, "deterministic");
    assert.equal(understanding.reportId, expected.report.id);
    assert.equal(understanding.issue.title, expected.report.subject);
    assert.equal(understanding.issue.category, expected.category);
    assert.equal(understanding.issue.department, expected.department);
    assert.equal(understanding.issue.severity, expected.severity);
    assert.equal(understanding.owner, expected.owner);
    assert.equal(understanding.reviewRequired, expected.reviewRequired);
    assert.deepEqual(understanding.issue.labels, [
      "support",
      expected.category,
      `${expected.severity}-severity`,
    ]);
  }
});

test("customer identity and issue content are extracted from report text", () => {
  const understanding = understandReportDeterministically(
    loginAuthenticationReport,
  );

  assert.deepEqual(understanding.customer, {
    name: "Maya Chen",
    email: "maya.chen@example.test",
  });
  assert.equal(
    understanding.issue.description,
    "I reset my password this morning, but the sign-in page still says authentication failed. This blocks access to our admin dashboard.",
  );
});

test("classification reads text rather than fixture identifiers", () => {
  const misleadingIdReport: SupportReport = {
    ...loginAuthenticationReport,
    id: "report-billing-timeout-misleading",
  };
  const understanding = understandReportDeterministically(misleadingIdReport);
  const classification = classifyReportText({
    subject: misleadingIdReport.subject,
    body: misleadingIdReport.body,
  });

  assert.equal(understanding.issue.category, "authentication");
  assert.equal(understanding.issue.department, "technical_support");
  assert.equal(classification.category, "authentication");
});

test("all evidence excerpts are literal report content", () => {
  for (const report of [
    loginAuthenticationReport,
    apiTimeoutReport,
    duplicateBillingChargeReport,
    ambiguousReviewReport,
  ]) {
    const understanding = understandReportDeterministically(report);
    const sourceText = `${report.subject}\n${report.body}`;

    assert.ok(understanding.evidence.length > 0);
    assert.ok(
      understanding.evidence.every(
        (evidence) =>
          evidence.excerpt.length > 0 && sourceText.includes(evidence.excerpt),
      ),
    );
  }
});

test("ambiguous and unknown text returns unresolved without an owner", () => {
  const reports: readonly SupportReport[] = [
    ambiguousReviewReport,
    {
      id: "report-unknown-005",
      receivedAt: "2026-01-09T08:00:00.000Z",
      subject: "Something went wrong yesterday",
      body: "Customer: Taylor Morgan\nEmail: taylor@example.test\nPlease help.",
    },
  ];

  for (const report of reports) {
    const understanding = understandReportDeterministically(report);
    assert.equal(understanding.issue.category, "unresolved");
    assert.equal(understanding.issue.department, "unresolved");
    assert.equal(understanding.owner, null);
    assert.equal(understanding.reviewRequired, true);
    assert.ok(understanding.confidence.overall < 0.5);
  }
});

test("typed routing resolves every required department and channel", () => {
  const expectedOwners: Readonly<Record<Department, string | null>> = {
    billing: "Awaiz",
    technical_support: "Umar",
    sales: "Bilal",
    logistics: "Obaid",
    product_development_and_engineering: "Noor",
    legal_privacy_and_compliance: "Huda",
    unresolved: null,
  };
  const channels = new Set<string>();

  for (const department of DEPARTMENTS) {
    const routing = routeDepartment(department);
    assert.equal(routing.owner, expectedOwners[department]);
    assert.equal(routing.channel, TEAM_ROUTING_CONFIG[department].channel);
    channels.add(routing.channel);
  }

  assert.equal(channels.size, DEPARTMENTS.length);
  assert.equal(routeDepartment("billing").rule, "billing -> Awaiz");
  assert.deepEqual(routeDepartment("unresolved"), {
    department: "unresolved",
    departmentName: "Unresolved",
    owner: null,
    channel: "#support-review",
    rule: "unresolved -> no owner",
    reviewRequired: true,
  });
});

test("understanding is deterministic for equivalent input", () => {
  const first = understandReportDeterministically(duplicateBillingChargeReport);
  const second = understandReportDeterministically({
    ...duplicateBillingChargeReport,
  });

  assert.deepEqual(first, second);
});
