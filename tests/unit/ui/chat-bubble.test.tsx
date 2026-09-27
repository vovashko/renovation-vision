import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChatBubble, ChatBubbleAttachment, ChatBubbleAuthor, ChatBubbleTime } from "@/components/ui/chat-bubble";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

describe("ChatBubble", () => {
  it("a sent bubble uses the primary fill and the sent corner radii", () => {
    render(<ChatBubble side="sent">Hi</ChatBubble>);
    const bubble = screen.getByText("Hi");
    expect(bubble).toHaveAttribute("data-side", "sent");
    expect(bubble.className).toContain("bg-primary");
    expect(bubble.className).toContain("text-on-primary");
    expect(bubble.className).toContain("rounded-[18px_18px_6px_18px]");
  });

  it("a received bubble (the default) uses the card fill and the received corner radii", () => {
    render(<ChatBubble>Hi</ChatBubble>);
    const bubble = screen.getByText("Hi");
    expect(bubble).toHaveAttribute("data-side", "received");
    expect(bubble.className).toContain("bg-card");
    expect(bubble.className).toContain("text-on-surface");
    expect(bubble.className).toContain("rounded-[18px_18px_18px_6px]");
  });

  it("caps the bubble width at 75% per spec", () => {
    render(<ChatBubble>Hi</ChatBubble>);
    expect(screen.getByText("Hi").className).toContain("max-w-[75%]");
  });
});

describe("ChatBubbleTime", () => {
  it("is 11px, colored per side", () => {
    const { rerender } = render(<ChatBubbleTime side="sent">09:14</ChatBubbleTime>);
    let time = screen.getByText("09:14");
    expect(time.className).toContain("text-[11px]");
    expect(time.className).toContain("text-primary-container");

    rerender(<ChatBubbleTime side="received">09:14</ChatBubbleTime>);
    time = screen.getByText("09:14");
    expect(time.className).toContain("text-on-surface-variant");
  });
});

describe("ChatBubbleAuthor", () => {
  it("renders the sender name in a small label", () => {
    render(<ChatBubbleAuthor side="received">Jonas Weber</ChatBubbleAuthor>);
    expect(screen.getByText("Jonas Weber").className).toContain("text-label-sm");
  });
});

describe("ChatBubbleAttachment", () => {
  it("links to the full-size image and opens it in a new tab", () => {
    render(<ChatBubbleAttachment href="https://example.com/photo.jpg" src="https://example.com/photo.jpg" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/photo.jpg");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/photo.jpg");
  });
});
