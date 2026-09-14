import type { OrbState } from "../../application/store/types";
import { cx } from "../ui/primitives";

export function RehearsalOrb({
  state = "idle",
  size = "medium",
  label,
}: {
  readonly state?: OrbState;
  readonly size?: "small" | "medium" | "large";
  readonly label?: string;
}) {
  return (
    <span
      aria-label={label ?? `Rehearsal status: ${state.replaceAll("_", " ")}`}
      className={cx(
        "rehearsal-orb",
        `rehearsal-orb--${state}`,
        `rehearsal-orb--${size}`,
      )}
      role="img"
    >
      <span className="rehearsal-orb__halo" />
      <span className="rehearsal-orb__outer" />
      <span className="rehearsal-orb__inner" />
      <span className="rehearsal-orb__core" />
    </span>
  );
}
