export const TEAM_ROUTES = {
  technical_support: { label: "Technical Support", owner: "Umar", channel: "technical-support", initials: "UM" },
  billing: { label: "Billing", owner: "Awaiz", channel: "billing-finance", initials: "AW" },
  sales: { label: "Sales", owner: "Bilal", channel: "sales", initials: "BI" },
  logistics: { label: "Logistics", owner: "Obaid", channel: "logistics", initials: "OB" },
  engineering: { label: "Product Development and Engineering", owner: "Noor", channel: "product-engineering", initials: "NO" },
  legal: { label: "Legal, Privacy and Compliance", owner: "Huda", channel: "legal-privacy", initials: "HU" },
} as const;
export type ResolvedDepartment = keyof typeof TEAM_ROUTES;
export type Department = ResolvedDepartment | "unresolved";
export function routeDepartment(department: Department) {
  return department === "unresolved" ? null : TEAM_ROUTES[department];
}
