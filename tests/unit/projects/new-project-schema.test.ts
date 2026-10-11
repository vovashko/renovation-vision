import { describe, it, expect } from "vitest";
import { newProjectSchema } from "@/features/projects/domain/schemas";

const base = {
  name: "Kitchen remodel",
  address_line: "",
  postal_code: "",
  city: "",
  country: "PL",
  currency: "PLN",
  status: "active",
  client_name: "Sarah",
  start_date: "",
  target_date: "",
  budget: 0,
};

describe("newProjectSchema client email", () => {
  it("is optional: omitting it defaults to an empty string", () => {
    const result = newProjectSchema.safeParse(base);
    expect(result.success && result.data.client_email).toBe("");
  });

  it("accepts a blank email", () => {
    expect(newProjectSchema.safeParse({ ...base, client_email: "" }).success).toBe(true);
  });

  it("accepts a valid email and trims it", () => {
    const result = newProjectSchema.safeParse({ ...base, client_email: " sarah@example.com " });
    expect(result.success && result.data.client_email).toBe("sarah@example.com");
  });

  it("rejects a malformed email", () => {
    const result = newProjectSchema.safeParse({ ...base, client_email: "sarah@" });
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.invalidEmail");
  });
});
