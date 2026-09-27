import { createElement, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Hoisted so the mock factory below (which vitest hoists above imports) can close over it.
const state = vi.hoisted(() => ({
  channelArgs: [] as unknown[][],
  onArgs: [] as unknown[][],
  removedChannels: [] as unknown[],
}));

vi.mock("@/lib/supabase", () => {
  const channel = {
    on: (...args: unknown[]) => {
      state.onArgs.push(args);
      return channel;
    },
    subscribe: () => channel,
  };
  return {
    supabase: {
      channel: (...args: unknown[]) => {
        state.channelArgs.push(args);
        return channel;
      },
      removeChannel: (ch: unknown) => {
        state.removedChannels.push(ch);
      },
    },
    MEDIA_BUCKET: "project-media",
  };
});

const { useChatRealtime } = await import("@/features/comms/hooks/use-chat-realtime");

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient();
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("useChatRealtime", () => {
  beforeEach(() => {
    state.channelArgs.length = 0;
    state.onArgs.length = 0;
    state.removedChannels.length = 0;
  });

  it("subscribes to postgres_changes on messages, filtered to this project", () => {
    renderHook(() => useChatRealtime("project-1"), { wrapper });

    expect(state.channelArgs).toEqual([["messages:project-1"]]);
    expect(state.onArgs).toHaveLength(1);
    const [event, config] = state.onArgs[0] as [string, Record<string, unknown>, unknown];
    expect(event).toBe("postgres_changes");
    expect(config).toMatchObject({
      event: "*",
      schema: "public",
      table: "messages",
      filter: "project_id=eq.project-1",
    });
  });

  it("uses a channel name and filter scoped to a different project", () => {
    renderHook(() => useChatRealtime("project-2"), { wrapper });

    expect(state.channelArgs).toEqual([["messages:project-2"]]);
    const [, config] = state.onArgs[0] as [string, Record<string, unknown>, unknown];
    expect(config).toMatchObject({ filter: "project_id=eq.project-2" });
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderHook(() => useChatRealtime("project-1"), { wrapper });
    expect(state.removedChannels).toHaveLength(0);

    unmount();

    expect(state.removedChannels).toHaveLength(1);
  });

  it("resubscribes with a new channel when the project id changes", () => {
    const { rerender } = renderHook(({ projectId }) => useChatRealtime(projectId), {
      wrapper,
      initialProps: { projectId: "project-1" },
    });
    rerender({ projectId: "project-2" });

    expect(state.channelArgs).toEqual([["messages:project-1"], ["messages:project-2"]]);
    expect(state.removedChannels).toHaveLength(1); // the first channel was torn down
  });
});
