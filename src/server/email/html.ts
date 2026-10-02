// HTML escaping for email templates. Pure, no server-only marker: templates/*.ts call this on any
// user-provided string (a notification title/body, a digest item) before it goes into HTML, since
// those strings never go through React/JSX escaping the way UI text does.

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Replaces `{{name}}` placeholders in an i18n string with `params[name]` (empty string if missing). */
export function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => params[key] ?? "");
}
