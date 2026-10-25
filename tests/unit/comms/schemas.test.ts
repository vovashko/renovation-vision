import { describe, it, expect } from "vitest";
import { announcementSchema } from "@/features/comms/domain/schemas";

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
    expect(announcementSchema.parse({ title: "T", body: "B", link: "/budget" }).link).toBe("/budget");
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
