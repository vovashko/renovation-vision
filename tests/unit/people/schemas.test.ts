import { describe, it, expect } from "vitest";
import { addManagerSchema, clientContactSchema, crewFormSchema } from "@/features/people/domain/schemas";

describe("addManagerSchema", () => {
  it("accepts a valid email", () => {
    expect(addManagerSchema.safeParse({ email: "jonas@renovision.demo" }).success).toBe(true);
  });

  it("rejects an empty email", () => {
    const result = addManagerSchema.safeParse({ email: "" });
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.required");
  });

  it("rejects a malformed email", () => {
    const result = addManagerSchema.safeParse({ email: "not-an-email" });
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.invalidEmail");
  });
});

describe("crewFormSchema", () => {
  it("accepts a name-only crew member (phone, trade and email optional)", () => {
    const result = crewFormSchema.safeParse({ full_name: "Alex", trade: "", phone: "", email: "" });
    expect(result.success).toBe(true);
  });

  it("requires a name", () => {
    const result = crewFormSchema.safeParse({ full_name: "  ", trade: "Electrician", phone: "", email: "" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.required");
  });

  it("rejects a malformed email but allows an empty one", () => {
    expect(crewFormSchema.safeParse({ full_name: "Alex", trade: "", phone: "", email: "not-an-email" }).success).toBe(false);
    expect(crewFormSchema.safeParse({ full_name: "Alex", trade: "", phone: "", email: "" }).success).toBe(true);
    expect(crewFormSchema.safeParse({ full_name: "Alex", trade: "", phone: "", email: "alex@example.com" }).success).toBe(true);
  });
});

describe("clientContactSchema", () => {
  it("accepts a name with optional phone and email", () => {
    expect(clientContactSchema.safeParse({ full_name: "Sarah & Tom Bennett", phone: "", email: "" }).success).toBe(true);
    expect(clientContactSchema.safeParse({ full_name: "Sarah", phone: "+1 555 0142", email: "sarah@example.com" }).success).toBe(true);
  });

  it("requires the client's name (it becomes the contact's full_name)", () => {
    const result = clientContactSchema.safeParse({ full_name: "", phone: "+1 555 0142", email: "" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.required");
  });

  it("rejects a malformed email", () => {
    const result = clientContactSchema.safeParse({ full_name: "Sarah", phone: "", email: "sarah@" });
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.invalidEmail");
  });
});
