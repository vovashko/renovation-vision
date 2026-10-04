import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import i18next from "eslint-plugin-i18next";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// The base `no-restricted-imports` rule, built per scope (flat config replaces a rule's options
// wholesale, so every scope below repeats the always-on entries). See README → Server functions &
// security; tests/unit/arch/boundaries.test.ts duplicates the server rules as a plain fs guard.
function restrictedImports({ admin = true, createServerFn = true, serverInternals = false } = {}) {
  const paths = [
    {
      name: "server-only",
      message:
        "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
    },
    {
      name: "@/lib/api",
      message: "@/lib/api was removed in T17. Use a repository from features/<f>/data via features/<f>/hooks.",
    },
    {
      name: "@/lib/queries",
      message: "@/lib/queries was removed in T17. Cache keys live in @/shared/query-keys; hooks live in features/<f>/hooks.",
    },
  ];
  const patterns = [];
  if (createServerFn) {
    paths.push({
      name: "@tanstack/react-start",
      importNames: ["createServerFn"],
      message: "Build server functions from authedFn/publicFn in @/server/fn, so they always get the error boundary, auth and rate limit.",
    });
  }
  if (admin) {
    patterns.push({
      regex: "(^|/)supabase/admin(\\.ts)?$",
      message: "The admin Supabase client bypasses RLS: only src/server/** may import it, after authorizing the caller.",
    });
  }
  if (serverInternals) {
    patterns.push(
      {
        regex: "^@/server/(?!(functions/[^/.]+|errors)$)",
        message:
          "Client-facing code may import only server functions (@/server/functions/*) and @/server/errors; the rest of src/server is server-side plumbing.",
      },
      {
        regex: "\\.server(\\.ts)?$",
        message: "*.server.ts modules are server-only (TanStack Start import protection); call a server function instead.",
      },
      {
        regex: "^@/lib/(env|supabase/server)$",
        message: "Server env and the server Supabase clients are server-only: use them from src/server/**.",
      },
    );
  }
  return ["error", { paths, patterns }];
}

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
      // Design handoff files waiting to be applied; they are copied into src/ when used.
      "code_handoff/**",
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
      "no-restricted-imports": restrictedImports(),
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Layer boundaries (README → Architecture). These use the typescript-eslint variant of the rule
  // so they don't replace the `server-only`/`@/lib/api`/`@/lib/queries` errors above.
  {
    files: ["src/routes/**/*.{ts,tsx}", "src/features/*/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
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
        "error",
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
  // User-visible text in feature UI, shared UI, routes and the remaining top-level components goes
  // through i18next (`t(...)`). `src/components/ui/**` (the design system primitives) is excluded:
  // primitives take their text via props, not literal JSX text. Attribute values that are
  // identifiers rather than text (classes, routes, ids, icon names, variants, ARIA references,
  // data-*) are ignored; `aria-label`, `title`, `placeholder`, `alt` and component props like
  // `label` are checked.
  {
    files: [
      "src/features/*/ui/**/*.{ts,tsx}",
      "src/shared/**/*.{ts,tsx}",
      "src/routes/**/*.{ts,tsx}",
      "src/components/*.tsx",
      "src/components/manager/**/*.{ts,tsx}",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
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
              "defaultNS",
              "fallbackNS",
              "ns",
            ],
          },
          callees: {
            // `useFormat()`'s methods take a locale-bound style/currency token ("short", "dayTime",
            // "PLN"…), never user-facing text, so calls like `format.date(d, "short")` are exempt.
            exclude: [
              "i18n(ext)?",
              "t",
              "cn",
              "cva",
              "clsx",
              "twMerge",
              "require",
              "includes",
              "startsWith",
              "endsWith",
              "date",
              "money",
              "dayLabel",
            ],
          },
          "object-properties": {
            // Route search/params and small enum-like values, never user-facing text: `search={{
            // view: "timeline" }}`, `navigate({ to: "...", search: { view } })`, `{ status: "pending" }`.
            exclude: ["to", "view", "status", "room"],
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
    rules: {
      // Tests exercise the admin client and the server-function runtime directly.
      "no-restricted-imports": restrictedImports({ admin: false, createServerFn: false }),
    },
  },
  // Server boundaries (README → Server functions & security).
  // - Only src/server/** may import the admin Supabase client (it bypasses RLS).
  // - Only src/server/fn.ts calls createServerFn; everything else builds on authedFn/publicFn.
  // - Client-facing code (features, routes, components, shared, domain, i18n) imports server
  //   functions and @/server/errors only, never middleware, *.server.ts, env or server clients.
  {
    files: ["src/server/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrictedImports({ admin: false }) },
  },
  {
    files: ["src/server/fn.ts"],
    rules: { "no-restricted-imports": restrictedImports({ admin: false, createServerFn: false }) },
  },
  {
    files: ["src/{features,routes,components,shared,domain,i18n}/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrictedImports({ serverInternals: true }) },
  },
  eslintConfigPrettier,
);
