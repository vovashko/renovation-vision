// Links that open a contact in the phone's dialler, mail app or WhatsApp. Pure: no Supabase, no React.

/** The fields of a contact the links are built from (a `contacts` row, or a client-visible contact). */
export type ContactLinkSource = {
  phone?: string | null;
  /** A WhatsApp number when it differs from the phone; the phone is used when this is empty. */
  whatsapp?: string | null;
  email?: string | null;
};

/** Each link is null when the contact has no number or address for it. */
export type ContactLinks = {
  tel: string | null;
  mailto: string | null;
  whatsapp: string | null;
};

/** The country code added to a 9-digit local number (Polish numbers are the default here). */
const DEFAULT_COUNTRY_CODE = "48";

/**
 * A phone number as international digits without the +: "600 100 200" → "48600100200",
 * "+48 (600) 100-200" → "48600100200", "0048 600 100 200" → "48600100200". A number that already has
 * a country code keeps it. Returns null when nothing usable is left (too short, too long, or no digits).
 */
export function internationalDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 9) digits = DEFAULT_COUNTRY_CODE + digits;
  // E.164 allows 15 digits at most; anything shorter than a local number is not dialable.
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

/**
 * `tel:`, `mailto:` and `https://wa.me/<digits>` links for a contact. WhatsApp prefers the contact's
 * WhatsApp number and falls back to the phone.
 */
export function contactLinks(contact: ContactLinkSource): ContactLinks {
  const phone = internationalDigits(contact.phone);
  const whatsapp = internationalDigits(contact.whatsapp) ?? phone;
  const email = contact.email?.trim();
  return {
    tel: phone ? `tel:+${phone}` : null,
    mailto: email ? `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}` : null,
    whatsapp: whatsapp ? `https://wa.me/${whatsapp}` : null,
  };
}
