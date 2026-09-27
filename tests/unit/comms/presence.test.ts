import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Hoisted so the mock factory below (which vitest hoists above imports) can close over it.
const state = vi.hoisted(() => ({
  channelCalls: [] as unknown[][],
  trackArgs: [] as unknown[],
  presenceState: {} as Record<string, unknown[]>,
  syncCb: null as (() => void) | null,
  removedChannels: [] as unknown[],
}));

vi.mock("@/lib/supabase", () => {
  const channel = {
    on: (type: string, opts: { event: string }, cb: () => void) => {
      if (type === "presence" && opts.event === "sync") state.syncCb = cb;
      return channel;
    },
    subscribe: (cb: (status: string) => void) => {
      cb("SUBSCRIBED");
      return channel;
    },
    track: (payload: unknown) => {
      state.trackArgs.push(payload);
      return Promise.resolve("ok");
    },
    presenceState: () => state.presenceState,
  };
  return {
    supabase: {
      channel: (...args: unknown[]) => {
        state.channelCalls.push(args);
        return channel;
      },
      removeChannel: (ch: unknown) => {
        state.removedChannels.push(ch);
      },
    },
    MEDIA_BUCKET: "project-media",
  };
});

const { usePresence } = await import("@/features/comms/hooks/use-presence");

describe("usePresence", () => {
  beforeEach(() => {
    state.channelCalls.length = 0;
    state.trackArgs.length = 0;
    state.presenceState = {};
    state.syncCb = null;
    state.removedChannels.length = 0;
  });

  it("joins the presence:project:<id> channel keyed by the caller's id", () => {
    renderHook(() => usePresence("project-1", { id: "user-1", name: "Jonas", role: "manager" }));

    expect(state.channelCalls).toEqual([["presence:project:project-1", { config: { presence: { key: "user-1" } } }]]);
  });

  it("tracks the caller's own name, role and a timestamp once subscribed", () => {
    renderHook(() => usePresence("project-1", { id: "user-1", name: "Jonas", role: "manager" }));

    expect(state.trackArgs).toHaveLength(1);
    expect(state.trackArgs[0]).toMatchObject({ name: "Jonas", role: "manager" });
    expect(state.trackArgs[0]).toHaveProperty("at");
  });

  it("maps the presence sync state to the list of online user ids", () => {
    const { result } = renderHook(() => usePresence("project-1", { id: "user-1", name: "Jonas", role: "manager" }));
    expect(result.current).toEqual([]);

    state.presenceState = { "user-1": [{}], "user-2": [{}] };
    act(() => state.syncCb?.());

    expect(result.current).toEqual(["user-1", "user-2"]);
  });

  it("joins no channel when there is no signed-in user yet", () => {
    renderHook(() => usePresence("project-1", null));

    expect(state.channelCalls).toHaveLength(0);
  });

  it("leaves the channel on unmount", () => {
    const { unmount } = renderHook(() => usePresence("project-1", { id: "user-1", name: "Jonas", role: "manager" }));
    unmount();

    expect(state.removedChannels).toHaveLength(1);
  });
});
