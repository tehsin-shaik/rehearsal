import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
export default [...nextVitals, ...nextTypescript, { ignores: ["node_modules/**", ".next*/**", ".open-next/**", "out/**", "coverage/**", "next-env.d.ts", "extension/**", "scripts/**"] }];
