// Where "Questions? Message your manager" points. Pure.
import { contactLinks } from "@/features/people/domain/contact-links";
import type { VisibleContact } from "@/lib/database.types";

/** The point of contact first, then any other visible contact (not the client); WhatsApp, else a call. Null without a number. */
export function managerContactHref(contacts: VisibleContact[]): string | null {
  const ordered = [...contacts.filter((c) => c.role === "poc"), ...contacts.filter((c) => c.role !== "poc" && c.role !== "client")];
  for (const contact of ordered) {
    // Clients only get a phone and an email for a contact, so WhatsApp uses the phone.
    const links = contactLinks({ phone: contact.phone, email: contact.email });
    const href = links.whatsapp ?? links.tel;
    if (href) return href;
  }
  return null;
}
