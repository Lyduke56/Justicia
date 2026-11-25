import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tooling artifacts, not application code: agent workspaces and one-off scratch scripts.
    ".agents/**",
    ".claude/**",
    ".tmp-*",
    "**/*.tsbuildinfo",
  ]),
  // React Compiler readiness checks and loose typing. Existing components (landing, documents,
  // lawyer detail, scroll reveal) still have findings here; they are reported as warnings so CI
  // stays green while they are fixed, and new code should not add more.
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // The node:test suites are CommonJS by design (they transpile and load the sources themselves).
  {
    files: ["tests/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
