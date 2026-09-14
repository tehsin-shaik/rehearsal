import {
  createApplicationCommands,
  type ApplicationCommandOptions,
  type ApplicationCommands,
} from "./commands/index.ts";
import {
  createRehearsalStore,
  type RehearsalStore,
} from "./store/rehearsal-store.ts";
import {
  createDemoDirector,
  type DemoDirector,
} from "../demo/controls/demo-director.ts";

export interface RehearsalApplication {
  readonly store: RehearsalStore;
  readonly commands: ApplicationCommands;
  readonly director: DemoDirector;
}

export function createRehearsalApplication(
  options: ApplicationCommandOptions = {},
): RehearsalApplication {
  const store = createRehearsalStore(options.mode);
  const commands = createApplicationCommands(store, options);
  const director = createDemoDirector(store, commands);
  return { store, commands, director };
}
