import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // SPEC.md §5: `any` banned; exceptions only with a justifying comment
      // (use an inline eslint-disable with the reason next to it).
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      // A8: every UI text goes through the dictionaries — no literal strings
      // rendered from components.
      "react/jsx-no-literals": "error",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/lib/storage.ts"],
    rules: {
      // G1: S3 is reached exclusively through src/lib/storage.ts — the SDK
      // must not leak into any other module.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@aws-sdk/*"],
              message:
                "S3 is reached only through src/lib/storage.ts (SPEC.md G1).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated outputs:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
