import "server-only";

import { readServerEnvironment } from "./environment-schema.ts";

export const serverEnvironment = readServerEnvironment(process.env);
