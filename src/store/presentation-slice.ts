import type { SourceApplication } from "../domain/events/taxonomy.ts";
export interface PresentationSlice { paused: boolean; excludedApps: readonly SourceApplication[]; ghostOpen: boolean; demoOpen: boolean; commandOpen: boolean; guide: boolean; sound: boolean; panelHeight: number; error: string | null; }
export const initialPresentation = (): PresentationSlice => ({ paused: false, excludedApps: [], ghostOpen: false, demoOpen: false, commandOpen: false, guide: true, sound: false, panelHeight: 360, error: null });
