import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Next/React Compiler: standard data-fetch-on-mount (`useEffect` + `void load()`) is flagged as
  // "setState in effect" even when state updates happen only after `await`. Too noisy for this app.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      // React Hook Form’s `watch()` is intentionally dynamic; Compiler skips memoization — acceptable here.
      "react-hooks/incompatible-library": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
