import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import i18next from "eslint-plugin-i18next";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".wrangler",
      ".tanstack",
      "docs/**",
      "supabase/**",
      "src/routeTree.gen.ts",
      "src/domain/db.types.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Layer boundaries (README → Architecture). Warnings for now: they are W2c's list of imports to move.
  // These use the typescript-eslint variant of the rule so they don't replace the `server-only` error above.
  {
    files: ["src/routes/**/*.{ts,tsx}", "src/features/*/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          paths: [
            { name: "@/lib/supabase", message: "Routes and feature UI don't talk to Supabase: use a hook from features/<f>/hooks." },
            { name: "@/lib/api", message: "Routes and feature UI don't call the API directly: use a hook from features/<f>/hooks." },
          ],
          patterns: [
            {
              group: ["@/features/*/data", "@/features/*/data/**"],
              message: "Only features/<f>/hooks import a repository (features/<f>/data).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*", "react-dom/*"], message: "src/domain is pure: no React." },
            { group: ["@supabase/*"], message: "src/domain is pure: no Supabase. Data access lives in features/<f>/data." },
            { group: ["@/components/**"], message: "src/domain is pure: no UI." },
          ],
        },
      ],
    },
  },
  // User-visible text in feature and shared UI goes through i18next (`t(...)`). Warnings for now: the
  // count is W2c's translation to-do list. Attribute values that are identifiers rather than text
  // (classes, routes, ids, icon names, variants, ARIA references, data-*) are ignored; `aria-label`,
  // `title`, `placeholder`, `alt` and component props like `label` are checked.
  {
    files: ["src/features/*/ui/**/*.{ts,tsx}", "src/shared/**/*.{ts,tsx}"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "warn",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            exclude: [
              "className",
              "style",
              "type",
              "key",
              "id",
              "htmlFor",
              "name",
              "to",
              "href",
              "src",
              "rel",
              "target",
              "role",
              "lang",
              "dir",
              "icon",
              "variant",
              "size",
              "side",
              "align",
              "orientation",
              "position",
              "tone",
              "value",
              "defaultValue",
              "autoComplete",
              "inputMode",
              "enterKeyHint",
              "accept",
              "capture",
              "loading",
              "decoding",
              "method",
              "form",
              "viewBox",
              "d",
              "fill",
              "stroke",
              "textAnchor",
              "dominantBaseline",
              "preserveAspectRatio",
              "data-.*",
              "aria-(?!label$|description$|placeholder$|roledescription$|valuetext$).*",
            ],
          },
          callees: {
            exclude: ["i18n(ext)?", "t", "cn", "cva", "clsx", "twMerge", "require", "includes", "startsWith", "endsWith"],
          },
          words: {
            // Numbers, punctuation and separators on their own ("·", "—", "%", "×"), and CONSTANT_CASE.
            exclude: ["[0-9!-/:-@[-`{-~\\s·—–…×•]+", "[A-Z_-]+"],
          },
        },
      ],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
);
