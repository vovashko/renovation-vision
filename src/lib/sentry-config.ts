// Settings shared between the browser (src/lib/sentry-client.ts) and Worker
// (src/lib/sentry-worker.ts) Sentry clients. Pure constants, no SDK import, trivial to unit test.
//
// EU data region: both the server DSN (SENTRY_DSN, a secret) and the browser DSN
// (VITE_SENTRY_DSN, public by design) must point at a `*.ingest.de.sentry.io` project — pick "EU"
// when creating the Sentry project (see README → Observability).

/** The commit this build was made from ("dev" locally); see vite.config.ts's `define`. */
export const SENTRY_RELEASE: string = __APP_RELEASE__;

// Low-volume tracing for now; no session replay (not configured anywhere in this app).
export const SENTRY_TRACES_SAMPLE_RATE = 0.1;
