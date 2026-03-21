// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // ── Base configs ──────────────────────────────────────────────
  eslint.configs.recommended,
  ...tseslint.configs.strict,

  // ── TypeScript project awareness (needed for type-checked rules) ──
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Rule overrides — prevent JS-isms in TypeScript ────────────
  {
    rules: {
      // No `any` — the #1 reason code stops being TypeScript
      "@typescript-eslint/no-explicit-any": "error",

      // Require return types on exported/public functions
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],

      // Ban non-null assertions (!) — force proper narrowing
      "@typescript-eslint/no-non-null-assertion": "error",

      // No unused vars (error, not warning)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Require `import type` for type-only imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // No require() — ESM only
      "@typescript-eslint/no-require-imports": "error",

      // Allow numbers in template literals (e.g. `Updated ${count} file(s)`)
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },

  // ── Ignore build output ───────────────────────────────────────
  {
    ignores: ["dist/", "node_modules/", "mcp-refactor-typescript/"],
  },
);
