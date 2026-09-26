import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

// jsdom doesn't implement `visualViewport` or `matchMedia` — stand in for both so the
// hook's resize/scroll listeners and its coarse-pointer check have something to read.
class FakeVisualViewport extends EventTarget {
  height: number;
  offsetTop: number;

  constructor(height: number, offsetTop = 0) {
    super();
    this.height = height;
    this.offsetTop = offsetTop;
  }

  resize(height: number, offsetTop = this.offsetTop) {
    this.height = height;
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event("resize"));
  }
}

describe("useKeyboardInset", () => {
  const originalInnerHeight = window.innerHeight;
  const originalVisualViewport = window.visualViewport;
  const originalMatchMedia = window.matchMedia;
  let viewport: FakeVisualViewport;

  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    viewport = new FakeVisualViewport(800);
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
    Object.defineProperty(window, "visualViewport", { value: originalVisualViewport, configurable: true });
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("starts closed with no inset when the viewport matches the window height", () => {
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current.inset).toBe(0);
    expect(result.current.open).toBe(false);
  });

  it("reports the keyboard inset once the visual viewport shrinks", () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => viewport.resize(500));
    expect(result.current.inset).toBe(300);
    expect(result.current.open).toBe(true);
  });

  it("ignores small height differences from browser chrome collapsing", () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => viewport.resize(760)); // 40px diff, below the 120px threshold
    expect(result.current.inset).toBe(0);
    expect(result.current.open).toBe(false);
  });

  it("reacts to viewport scroll events too", () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.inset).toBe(300);
  });

  it("closes again once the viewport returns to full height", () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => viewport.resize(500));
    expect(result.current.open).toBe(true);
    act(() => viewport.resize(800));
    expect(result.current.inset).toBe(0);
    expect(result.current.open).toBe(false);
  });

  it("cleans up its visualViewport and document listeners on unmount", () => {
    const addViewportSpy = vi.spyOn(viewport, "addEventListener");
    const removeViewportSpy = vi.spyOn(viewport, "removeEventListener");
    const addDocSpy = vi.spyOn(document, "addEventListener");
    const removeDocSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useKeyboardInset());

    expect(addViewportSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(addViewportSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(addDocSpy).toHaveBeenCalledWith("focusin", expect.any(Function));
    expect(addDocSpy).toHaveBeenCalledWith("focusout", expect.any(Function));

    unmount();

    expect(removeViewportSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeViewportSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(removeDocSpy).toHaveBeenCalledWith("focusin", expect.any(Function));
    expect(removeDocSpy).toHaveBeenCalledWith("focusout", expect.any(Function));

    // Resizing after unmount must not update state the component no longer owns.
    act(() => viewport.resize(400));
  });
});
