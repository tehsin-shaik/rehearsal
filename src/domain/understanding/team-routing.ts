export const DEPARTMENTS = [
  "billing",
  "technical_support",
  "sales",
  "logistics",
  "product_development_and_engineering",
  "legal_privacy_and_compliance",
  "unresolved",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const TEAM_OWNERS = [
  "Tehsin",
  "Elyes",
  "Raghad",
  "Ayah",
  "Sara",
  "Alex",
] as const;

export type TeamOwner = (typeof TEAM_OWNERS)[number];

interface TeamRouteConfiguration {
  readonly displayName: string;
  readonly owner: TeamOwner | null;
  readonly channel: string;
  readonly rule: string;
}

export const TEAM_ROUTING_CONFIG = {
  billing: {
    displayName: "Billing",
    owner: "Tehsin",
    channel: "#billing-finance",
    rule: "billing -> Tehsin",
  },
  technical_support: {
    displayName: "Technical Support",
    owner: "Elyes",
    channel: "#technical-support",
    rule: "technical support -> Elyes",
  },
  sales: {
    displayName: "Sales",
    owner: "Raghad",
    channel: "#sales-support",
    rule: "sales -> Raghad",
  },
  logistics: {
    displayName: "Logistics",
    owner: "Ayah",
    channel: "#logistics-support",
    rule: "logistics -> Ayah",
  },
  product_development_and_engineering: {
    displayName: "Product Development and Engineering",
    owner: "Sara",
    channel: "#product-development-engineering",
    rule: "product development and engineering -> Sara",
  },
  legal_privacy_and_compliance: {
    displayName: "Legal, Privacy and Compliance",
    owner: "Alex",
    channel: "#legal-privacy-compliance",
    rule: "legal, privacy and compliance -> Alex",
  },
  unresolved: {
    displayName: "Unresolved",
    owner: null,
    channel: "#support-review",
    rule: "unresolved -> no owner",
  },
} as const satisfies Record<Department, TeamRouteConfiguration>;

export interface TeamRoutingResult {
  readonly department: Department;
  readonly departmentName: string;
  readonly owner: TeamOwner | null;
  readonly channel: string;
  readonly rule: string;
  readonly reviewRequired: boolean;
}

export function routeDepartment(department: Department): TeamRoutingResult {
  const route = TEAM_ROUTING_CONFIG[department];

  return {
    department,
    departmentName: route.displayName,
    owner: route.owner,
    channel: route.channel,
    rule: route.rule,
    reviewRequired: route.owner === null,
  };
}

export function isTeamOwner(value: string): value is TeamOwner {
  return TEAM_OWNERS.some((owner) => owner === value);
}

export function routeOwner(owner: TeamOwner): TeamRoutingResult {
  for (const department of DEPARTMENTS) {
    const route = routeDepartment(department);
    if (route.owner === owner) {
      return route;
    }
  }

  throw new RangeError(`No routing configuration exists for owner ${owner}.`);
}
