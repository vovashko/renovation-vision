import { describe, expect, it } from "vitest";
import { contactLinks, internationalDigits } from "@/features/people/domain/contact-links";

describe("internationalDigits", () => {
  it("adds 48 to a 9-digit Polish number", () => {
    expect(internationalDigits("600100200")).toBe("48600100200");
    expect(internationalDigits("600 100 200")).toBe("48600100200");
    expect(internationalDigits("600-100-200")).toBe("48600100200");
  });

  it("strips spaces, dashes, parentheses and a leading +", () => {
    expect(internationalDigits("+48 (600) 100-200")).toBe("48600100200");
    expect(internationalDigits("+48600100200")).toBe("48600100200");
  });

  it("keeps a number that already has a country code, and reads a 00 prefix as +", () => {
    expect(internationalDigits("+44 20 7946 0958")).toBe("442079460958");
    expect(internationalDigits("0048 600 100 200")).toBe("48600100200");
    expect(internationalDigits("48 600 100 200")).toBe("48600100200");
  });

  it("returns null for nothing usable", () => {
    expect(internationalDigits(null)).toBeNull();
    expect(internationalDigits(undefined)).toBeNull();
    expect(internationalDigits("")).toBeNull();
    expect(internationalDigits("   ")).toBeNull();
    expect(internationalDigits("call me")).toBeNull();
    expect(internationalDigits("12345")).toBeNull();
    expect(internationalDigits("+1234567890123456")).toBeNull();
  });
});

describe("contactLinks", () => {
  it("builds tel:, mailto: and wa.me links", () => {
    expect(contactLinks({ phone: "600 100 200", email: "jonas@example.com" })).toEqual({
      tel: "tel:+48600100200",
      mailto: "mailto:jonas@example.com",
      whatsapp: "https://wa.me/48600100200",
    });
  });

  it("prefers the WhatsApp number over the phone, and falls back to the phone", () => {
    expect(contactLinks({ phone: "600 100 200", whatsapp: "+44 20 7946 0958" })).toMatchObject({
      tel: "tel:+48600100200",
      whatsapp: "https://wa.me/442079460958",
    });
    expect(contactLinks({ phone: "600 100 200", whatsapp: "" }).whatsapp).toBe("https://wa.me/48600100200");
    expect(contactLinks({ phone: "600 100 200", whatsapp: "not a number" }).whatsapp).toBe("https://wa.me/48600100200");
  });

  it("gives no link for a missing number or address", () => {
    expect(contactLinks({})).toEqual({ tel: null, mailto: null, whatsapp: null });
    expect(contactLinks({ phone: null, whatsapp: null, email: "  " })).toEqual({ tel: null, mailto: null, whatsapp: null });
    expect(contactLinks({ email: "a@b.pl" })).toEqual({ tel: null, mailto: "mailto:a@b.pl", whatsapp: null });
  });

  it("uses a WhatsApp number even when there is no phone", () => {
    expect(contactLinks({ whatsapp: "601 222 333" })).toEqual({ tel: null, mailto: null, whatsapp: "https://wa.me/48601222333" });
  });

  it("URL-encodes the address but keeps the @", () => {
    expect(contactLinks({ email: "jan+reno@example.com" }).mailto).toBe("mailto:jan%2Breno@example.com");
    expect(contactLinks({ email: " a b@example.com " }).mailto).toBe("mailto:a%20b@example.com");
  });
});
