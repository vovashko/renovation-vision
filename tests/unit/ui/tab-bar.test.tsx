import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TabBar, TabBarItem, TabBarRow } from "@/components/ui/tab-bar";

afterEach(cleanup);

describe("TabBar", () => {
  it("marks the active tab with aria-current, not the others", () => {
    render(
      <TabBar>
        <TabBarItem icon="home" label="Home" active />
        <TabBarItem icon="chat_bubble" label="Chat" />
      </TabBar>,
    );
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Chat" })).not.toHaveAttribute("aria-current");
  });

  it("TabBarRow renders its icon and label", () => {
    render(<TabBarRow icon="settings">Settings</TabBarRow>);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});
