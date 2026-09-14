"use client";

import Link from "next/link";

import { RehearsalMark } from "../brand/rehearsal-mark";
import { useRehearsalState } from "../providers/rehearsal-provider";
import { Icon } from "../ui/icon";
import { buttonClassName } from "../ui/primitives";

export function AppPageHeader() {
  const orbState = useRehearsalState((state) => state.presentation.orbState);
  return (
    <header className="app-page__header">
      <RehearsalMark linked state={orbState} />
      <nav aria-label="Application" className="app-page__nav">
        <Link className="topbar-link" href="/workflows">
          Workflows
        </Link>
        <Link className="topbar-link" href="/activity">
          Activity
        </Link>
        <Link className="topbar-link" href="/privacy">
          Privacy
        </Link>
        <Link className={buttonClassName("primary", true)} href="/workspace">
          Open workspace <Icon name="arrow" size={12} />
        </Link>
      </nav>
    </header>
  );
}
