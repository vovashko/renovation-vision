import { describe, it, expect } from "vitest";
import { knowledgeEntrySchema } from "@/features/knowledge/domain/schemas";

describe("knowledgeEntrySchema", () => {
  it("requires a title", () => {
    const result = knowledgeEntrySchema.safeParse({ title: "", content: "Answer", tags: "", is_visible: true });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["title"]);
  });

  it("requires content", () => {
    const result = knowledgeEntrySchema.safeParse({ title: "Working hours", content: "  ", tags: "", is_visible: true });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["content"]);
  });

  it("parses tags: trims, splits on comma, drops empty entries", () => {
    const result = knowledgeEntrySchema.parse({
      title: "Working hours",
      content: "8am–4pm on weekdays.",
      tags: " kitchen ,  delivery,,hours ",
      is_visible: true,
    });
    expect(result.tags).toEqual(["kitchen", "delivery", "hours"]);
  });

  it("parses an empty tags string as no tags", () => {
    const result = knowledgeEntrySchema.parse({ title: "Working hours", content: "8am–4pm.", tags: "", is_visible: false });
    expect(result.tags).toEqual([]);
    expect(result.is_visible).toBe(false);
  });

  it("trims title and content", () => {
    const result = knowledgeEntrySchema.parse({ title: "  Working hours  ", content: "  8am–4pm.  ", tags: "", is_visible: true });
    expect(result.title).toBe("Working hours");
    expect(result.content).toBe("8am–4pm.");
  });
});
