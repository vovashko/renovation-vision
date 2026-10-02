// What an emailed auth link left in the URL when it landed on one of our pages.
//
// The auth emails (supabase/templates/*.html) link to `{{ .ConfirmationURL }}`: gotrue's /verify
// endpoint, which redirects to the `redirectTo` the app asked for. Because the browser client
// (@supabase/ssr) uses the PKCE flow, a link the app requested lands with `?code=…`, which the
// browser client exchanges by itself on load (detectSessionInUrl) using the code verifier it kept
// in a cookie. A failed verification lands with `error`/`error_code`/`error_description`, in the
// query or the fragment. Links built from `token_hash` (`?token_hash=…&type=recovery`, e.g. from
// the admin API's generateLink) are verified by the page itself with verifyOtp.

export type EmailLinkType = "recovery" | "magiclink" | "email" | "signup" | "invite" | "email_change";

const LINK_TYPES: readonly string[] = ["recovery", "magiclink", "email", "signup", "invite", "email_change"];

export type AuthLinkParams = {
  /** gotrue's error for a link that didn't verify (expired, already used, …). */
  error: { code: string; description: string } | null;
  /** A PKCE auth code (the browser client exchanges it). */
  code: string | null;
  /** A hashed one-time token to verify with verifyOtp, and its type. */
  tokenHash: string | null;
  type: EmailLinkType | null;
};

export function readAuthLink(href: string): AuthLinkParams {
  let url: URL;
  try {
    url = new URL(href, "http://placeholder.invalid");
  } catch {
    return { error: null, code: null, tokenHash: null, type: null };
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const get = (name: string) => url.searchParams.get(name) ?? hash.get(name);
  const errorCode = get("error_code") ?? get("error");
  const type = get("type");
  return {
    error: errorCode ? { code: errorCode, description: get("error_description") ?? "" } : null,
    code: url.searchParams.get("code"),
    tokenHash: get("token_hash"),
    type: type && LINK_TYPES.includes(type) ? (type as EmailLinkType) : null,
  };
}

/** True when the URL carries anything an auth link leaves behind. */
export const hasAuthLink = (params: AuthLinkParams) => !!(params.error || params.code || params.tokenHash);
