import { describe, it, expect } from "vitest";
import { crewFormSchema, memberFormSchema } from "@/features/people/domain/schemas";

describe("memberFormSchema", () => {
  it("accepts a valid email and role", () => {
    const result = memberFormSchema.safeParse({ email: "sarah@renovision.demo", role: "client" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty email", () => {
    const result = memberFormSchema.safeParse({ email: "", role: "client" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.required");
  });

  it("rejects a malformed email", () => {
    const result = memberFormSchema.safeParse({ email: "not-an-email", role: "manager" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.invalidEmail");
  });

  it("rejects a role outside client/manager", () => {
    const result = memberFormSchema.safeParse({ email: "sarah@renovision.demo", role: "admin" });
    expect(result.success).toBe(false);
  });
});

describe("crewFormSchema", () => {
  it("accepts a name-only crew member (phone, trade and email optional)", () => {
    const result = crewFormSchema.safeParse({ name: "Alex", trade: "", phone: "", email: "" });
    expect(result.success).toBe(true);
  });

  it("requires a name", () => {
    const result = crewFormSchema.safeParse({ name: "", trade: "Electrician", phone: "", email: "" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.required");
  });

  it("rejects a malformed email but allows an empty one", () => {
    expect(crewFormSchema.safeParse({ name: "Alex", trade: "", phone: "", email: "not-an-email" }).success).toBe(false);
    expect(crewFormSchema.safeParse({ name: "Alex", trade: "", phone: "", email: "" }).success).toBe(true);
    expect(crewFormSchema.safeParse({ name: "Alex", trade: "", phone: "", email: "alex@example.com" }).success).toBe(true);
  });
});
