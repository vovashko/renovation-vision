import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfilePanel } from "@/components/profile-panel";
import { useAuth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function authValue(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    status: "signed-in" as const,
    userId: "u1",
    email: "jane@example.com",
    profile: { id: "u1", full_name: "Jane Doe", avatar_url: null, account_type: "client" as const },
    signIn: vi.fn(),
    sendMagicLink: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseAuth.mockReset();
});

describe("ProfilePanel", () => {
  it("shows the signed-in user's name", () => {
    mockedUseAuth.mockReturnValue(authValue());
    render(<ProfilePanel open onOpenChange={() => {}} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("offers sign out", () => {
    mockedUseAuth.mockReturnValue(authValue());
    render(<ProfilePanel open onOpenChange={() => {}} />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
