import Link from "next/link";

import { RehearsalMark } from "@/components/brand/rehearsal-mark";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  Badge,
  TintedPanel,
  buttonClassName,
} from "@/components/ui/primitives";
import { brand } from "@/config/brand";

const FLOW_STEPS: readonly {
  readonly label: string;
  readonly icon: IconName;
}[] = [
  { label: "Observe", icon: "eye" },
  { label: "Detect", icon: "search" },
  { label: "Compile", icon: "workflow" },
  { label: "Preview Run", icon: "spark" },
  { label: "Approve", icon: "shield" },
  { label: "Execute", icon: "bolt" },
];

const BENEFITS: readonly {
  readonly title: string;
  readonly detail: string;
  readonly icon: IconName;
  readonly tint: "cyan" | "violet" | "teal";
}[] = [
  {
    title: "Watches meaning, not clicks",
    detail:
      "Rehearsal records semantic work across mail, issue tracking, and team chat—not coordinates, selectors, or raw keys.",
    icon: "eye",
    tint: "cyan",
  },
  {
    title: "Generalizes rules and values",
    detail:
      "Repeated behavior becomes a typed workflow with variables, constants, evidence, and explicit routing dependencies.",
    icon: "workflow",
    tint: "cyan",
  },
  {
    title: "Shows the plan before acting",
    detail:
      "Every consequential step appears in a resolved Preview Run and remains blocked until a person approves it.",
    icon: "shield",
    tint: "violet",
  },
];

export default function Home() {
  return (
    <main className="site-page">
      <div className="site-shell">
        <header className="site-header">
          <RehearsalMark linked />
          <nav aria-label="Primary" className="site-nav">
            <Link className="site-nav__link" href="/workflows">
              Workflows
            </Link>
            <Link className="site-nav__link" href="/privacy">
              Privacy
            </Link>
            <Link
              className={buttonClassName("primary", true)}
              href="/workspace"
            >
              Open workspace <Icon name="arrow" size={13} />
            </Link>
          </nav>
        </header>

        <section className="hero">
          <div className="hero__copy">
            <Badge tone="cyan">
              <Icon name="shield" size={11} /> Human-supervised workflow
              learning
            </Badge>
            <h1>
              Teach it through work.
              <span>Approve before it acts.</span>
            </h1>
            <p className="hero__lead">
              Rehearsal turns repeated operational behavior into structured
              automation, previews every resolved action, and keeps
              consequential work behind a human approval boundary.
            </p>
            <div className="hero__actions">
              <Link className={buttonClassName("primary")} href="/onboarding">
                Begin onboarding <Icon name="arrow" size={14} />
              </Link>
              <Link className={buttonClassName("secondary")} href="/workspace">
                Open workspace
              </Link>
            </div>
          </div>

          <div aria-label="Rehearsal workflow" className="hero-flow">
            {FLOW_STEPS.map((step) => (
              <div className="hero-flow__step" key={step.label}>
                <span className="hero-flow__icon">
                  <Icon name={step.icon} size={15} />
                </span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Benefits" className="benefit-grid">
          {BENEFITS.map((benefit) => (
            <TintedPanel
              className="benefit-card"
              key={benefit.title}
              tint={benefit.tint}
            >
              <span className="benefit-card__icon">
                <Icon name={benefit.icon} size={16} />
              </span>
              <h2>{benefit.title}</h2>
              <p>{benefit.detail}</p>
            </TintedPanel>
          ))}
        </section>

        <footer className="site-footer">
          <span>{brand.productName}</span>
          <div className="site-footer__group">
            <span>
              <Badge tone="teal">Demo Mode</Badge> available offline
            </span>
            <Link href="/privacy">Privacy</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
