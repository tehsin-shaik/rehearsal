import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
const config = [...nextVitals, ...nextTypescript, { ignores: ["node_modules/**", ".next*/**", ".open-next/**", "out/**", "coverage/**", "next-env.d.ts", "extension/**", "scripts/**"] }];

export default config;
