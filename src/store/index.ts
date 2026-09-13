"use client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { RehearsalSession } from "../application/commands/session.ts";
export const session = new RehearsalSession();
const store = createStore(() => session.getSnapshot());
session.subscribe(() => store.setState(session.getSnapshot(), true));
export function useRehearsal() { return useStore(store); }
