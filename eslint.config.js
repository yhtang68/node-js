import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  // Global ignores (VERY important for monorepo)
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**"
    ]
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Apply only to TS/JS source files
  {
    files: ["**/*.{ts,js}"],

    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },

    rules: {
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
];