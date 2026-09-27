import { describe, it, expect } from "vitest";
import { announcementSchema, canSendMessage, MAX_MESSAGE_LENGTH, messageSchema } from "@/features/comms/domain/schemas";

describe("announcementSchema", () => {
  it("requires a non-empty title and body", () => {
    expect(announcementSchema.safeParse({ title: "", body: "", link: "" }).success).toBe(false);
    expect(announcementSchema.safeParse({ title: "   ", body: "Body", link: "" }).success).toBe(false);
    expect(announcementSchema.safeParse({ title: "Title", body: "   ", link: "" }).success).toBe(false);
  });

  it("trims the title and body", () => {
    const result = announcementSchema.parse({ title: "  Water off  ", body: "  Thursday morning  ", link: "" });
    expect(result.title).toBe("Water off");
    expect(result.body).toBe("Thursday morning");
  });

  it("turns an empty link into null (the link is optional)", () => {
    expect(announcementSchema.parse({ title: "T", body: "B", link: "" }).link).toBeNull();
    expect(announcementSchema.parse({ title: "T", body: "B", link: "   " }).link).toBeNull();
  });

  it("keeps a chosen link", () => {
    expect(announcementSchema.parse({ title: "T", body: "B", link: "/chat" }).link).toBe("/chat");
  });

  it("rejects a title over 80 characters", () => {
    expect(announcementSchema.safeParse({ title: "a".repeat(81), body: "B", link: "" }).success).toBe(false);
    expect(announcementSchema.safeParse({ title: "a".repeat(80), body: "B", link: "" }).success).toBe(true);
  });

  it("uses i18n keys for its error messages", () => {
    const result = announcementSchema.safeParse({ title: "", body: "", link: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      for (const issue of result.error.issues) expect(issue.message).toBe("common:form.required");
    }
  });
});

describe("messageSchema / canSendMessage", () => {
  it("accepts a non-empty trimmed body with no attachment", () => {
    expect(canSendMessage("Hello there", false)).toBe(true);
  });

  it("rejects an empty or whitespace-only body with no attachment", () => {
    expect(canSendMessage("", false)).toBe(false);
    expect(canSendMessage("   \n  ", false)).toBe(false);
  });

  it("accepts an empty body when there is an attachment", () => {
    expect(canSendMessage("", true)).toBe(true);
    expect(canSendMessage("   ", true)).toBe(true);
  });

  it(`accepts a body of exactly ${MAX_MESSAGE_LENGTH} characters`, () => {
    expect(canSendMessage("a".repeat(MAX_MESSAGE_LENGTH), false)).toBe(true);
  });

  it(`rejects a body over ${MAX_MESSAGE_LENGTH} characters`, () => {
    expect(canSendMessage("a".repeat(MAX_MESSAGE_LENGTH + 1), false)).toBe(false);
  });

  it("rejects neither a body nor an attachment, even with whitespace", () => {
    const result = messageSchema.safeParse({ body: "   ", hasAttachment: false });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("comms:chat.composer.empty");
  });
});
