"use client";
import { useSyncExternalStore } from "react";
import { RehearsalSession } from "../application/commands/session.ts";
export const session = new RehearsalSession();
const serverSnapshot = session.getSnapshot();
export function useRehearsal() { return useSyncExternalStore(session.subscribe, session.getSnapshot, () => serverSnapshot); }
