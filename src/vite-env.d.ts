/// <reference types="vite/client" />

// A build-time git SHA ("dev" locally), inlined by vite.config.ts's `define` (mirrored in
// vitest.config.ts). See src/lib/sentry-config.ts.
declare const __APP_RELEASE__: string;
