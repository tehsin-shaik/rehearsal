export const loginAuthenticationReport = {
  id: "report-login-001",
  receivedAt: "2026-01-05T09:00:00.000Z",
  subject: "Unable to sign in after password reset",
  body: [
    "Customer: Alex Chen",
    "Email: alex.chen@example.test",
    "I reset my password this morning, but the sign-in page still says authentication failed.",
    "This blocks access to our admin dashboard.",
  ].join("\n"),
} as const;

export const apiTimeoutReport = {
  id: "report-api-002",
  receivedAt: "2026-01-06T10:15:00.000Z",
  subject: "Production API requests time out",
  body: [
    "Customer: Priya Raman",
    "Email: priya.raman@example.test",
    "Requests to the production orders endpoint time out after 30 seconds.",
    "The timeout affects every request from our service.",
  ].join("\n"),
} as const;

export const duplicateBillingChargeReport = {
  id: "report-billing-003",
  receivedAt: "2026-01-07T11:30:00.000Z",
  subject: "Duplicate charge on January invoice",
  body: [
    "Customer: Daniel Okafor",
    "Email: daniel.okafor@example.test",
    "Our January invoice contains the same subscription charge twice.",
    "Please route this duplicate billing charge to the billing team for review.",
  ].join("\n"),
} as const;

export const ambiguousReviewReport = {
  id: "report-ambiguous-004",
  receivedAt: "2026-01-08T12:45:00.000Z",
  subject: "Account problem",
  body: [
    "Customer: Mara Feld",
    "Email: mara.feld@example.test",
    "Something changed in my account and I need help.",
    "I cannot tell whether this is a technical or billing problem.",
  ].join("\n"),
} as const;

