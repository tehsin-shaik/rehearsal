import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

import { Icon, type IconName } from "./icon";

export function cx(
  ...values: readonly (string | false | null | undefined)[]
): string {
  return values.filter(Boolean).join(" ");
}

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "violet";

export function buttonClassName(
  variant: ButtonVariant = "secondary",
  compact = false,
): string {
  return cx("button", `button--${variant}`, compact && "button--compact");
}

export function Button({
  className,
  variant = "secondary",
  compact = false,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
  readonly compact?: boolean;
}) {
  return (
    <button
      className={cx(buttonClassName(variant, compact), className)}
      type={type}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cx("panel", className)} {...props} />;
}

export function FlatPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <section className={cx("flat-panel", className)} {...props} />;
}

export function TintedPanel({
  className,
  tint = "cyan",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  readonly tint?: "cyan" | "violet" | "amber" | "teal" | "rose";
}) {
  return (
    <section
      className={cx("tinted-panel", `tinted-panel--${tint}`, className)}
      {...props}
    />
  );
}

export function PanelHeader({
  eyebrow,
  title,
  icon,
  action,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly icon?: IconName;
  readonly action?: ReactNode;
}) {
  return (
    <header className="panel-header">
      <div className="panel-header__title">
        {icon && <Icon name={icon} size={15} />}
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
      </div>
      {action && <div className="panel-header__action">{action}</div>}
    </header>
  );
}

export type BadgeTone =
  "neutral" | "cyan" | "violet" | "teal" | "amber" | "rose";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
  readonly className?: string;
}) {
  return (
    <span className={cx("badge", `badge--${tone}`, className)}>{children}</span>
  );
}

export function StatusDot({
  tone = "neutral",
  pulse = false,
}: {
  readonly tone?: BadgeTone;
  readonly pulse?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("status-dot", `status-dot--${tone}`, pulse && "is-pulsing")}
    />
  );
}

export function ConfidenceBar({
  value,
  tone = "cyan",
  label = "Confidence",
}: {
  readonly value: number;
  readonly tone?: Extract<
    BadgeTone,
    "cyan" | "violet" | "teal" | "amber" | "rose"
  >;
  readonly label?: string;
}) {
  const percentage = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="confidence">
      <div className="confidence__label">
        <span>{label}</span>
        <span className="mono">{percentage}%</span>
      </div>
      <div
        aria-label={`${label}: ${percentage}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percentage}
        className="confidence__track"
        role="progressbar"
      >
        <span
          className={cx("confidence__fill", `confidence__fill--${tone}`)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly detail?: string;
}) {
  return (
    <div className="metric">
      <span className="metric__label">{label}</span>
      <strong className="metric__value mono">{value}</strong>
      {detail && <span className="metric__detail">{detail}</span>}
    </div>
  );
}

export function Tooltip({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <span className="tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { readonly children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

export function EmptyState({
  icon = "search",
  title,
  detail,
  action,
}: {
  readonly icon?: IconName;
  readonly title: string;
  readonly detail: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={20} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export function Divider() {
  return <div aria-hidden="true" className="divider" />;
}

export function WindowFrame({
  title,
  identity,
  icon,
  action,
  className,
  children,
}: {
  readonly title: string;
  readonly identity: string;
  readonly icon: IconName;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={cx("window-frame", className)}>
      <header className="window-frame__bar">
        <span className="window-frame__identity">
          <Icon name={icon} size={14} /> {identity}
        </span>
        <span className="window-frame__title">{title}</span>
        <span className="window-frame__action">{action}</span>
      </header>
      <div className="window-frame__body">{children}</div>
    </section>
  );
}

export function Avatar({
  name,
  agent = false,
}: {
  readonly name: string;
  readonly agent?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span aria-label={name} className={cx("avatar", agent && "avatar--agent")}>
      {initials}
    </span>
  );
}

export function FormField({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  readonly label: string;
  readonly hint?: string;
}) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <input className={cx("input", className)} {...props} />
      {hint && <span className="form-field__hint">{hint}</span>}
    </label>
  );
}

export function GuideRing({
  active,
  children,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
}) {
  return (
    <span className={cx("guide-ring", active && "is-active")}>{children}</span>
  );
}
