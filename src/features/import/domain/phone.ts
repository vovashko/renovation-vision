// Phone numbers in a sheet → E.164 ("+48600100200"), the form import_contacts requires and wa.me links need.
// Pure. It never guesses a country except for a bare 9-digit number, which is a Polish number (the app's default).

const E164 = /^\+[1-9][0-9]{6,14}$/;

/**
 * "600 100 200" → "+48600100200", "+48 (600) 100-200" → "+48600100200", "0048 600 100 200" → "+48600100200".
 * Returns undefined when the text is not a valid E.164 number (letters, no country code, too short or too long).
 * An empty cell is not an error: use `""` for it before calling.
 */
export function toE164(raw: string): string | undefined {
  let value = raw.replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  else if (!value.startsWith("+") && /^[0-9]{9}$/.test(value)) value = `+48${value}`;
  return E164.test(value) ? value : undefined;
}
