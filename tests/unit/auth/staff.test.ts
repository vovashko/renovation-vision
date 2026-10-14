import { describe, expect, it } from "vitest";
import { isStaff } from "@/domain/account";
import { isStaffAccount } from "@/features/auth/domain/mfa-guard";

describe("isStaff", () => {
  it("is true for the admin account type, which the product calls Manager", () => {
    expect(isStaff("admin")).toBe(true);
  });

  it("is false for clients, missing profiles and the retired manager type", () => {
    for (const type of ["client", "manager", "", null, undefined]) expect(isStaff(type)).toBe(false);
  });

  it("is the same check the 2FA guard uses", () => {
    expect(isStaffAccount("admin")).toBe(true);
    expect(isStaffAccount("client")).toBe(false);
  });
});
