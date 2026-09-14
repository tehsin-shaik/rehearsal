import Link from "next/link";

import { brand } from "../../config/brand";
import type { OrbState } from "../../application/store/types";
import { cx } from "../ui/primitives";
import { RehearsalOrb } from "./rehearsal-orb";

export function RehearsalMark({
  compact = false,
  state = "idle",
  linked = false,
}: {
  readonly compact?: boolean;
  readonly state?: OrbState;
  readonly linked?: boolean;
}) {
  const content = (
    <span
      className={cx("rehearsal-mark", compact && "rehearsal-mark--compact")}
    >
      <RehearsalOrb size="small" state={state} />
      {!compact && (
        <span className="rehearsal-mark__word">{brand.productName}</span>
      )}
    </span>
  );
  return linked ? (
    <Link aria-label="Rehearsal home" href="/">
      {content}
    </Link>
  ) : (
    content
  );
}
