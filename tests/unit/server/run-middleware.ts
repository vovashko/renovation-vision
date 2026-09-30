// Runs the SERVER halves of TanStack Start function middleware the way Start does (dependencies
// first, each middleware once, `next({ context })` merging into the context), without the Start
// runtime or compiler. Returns the context the handler would have received.

type AnyMiddleware = { options: { middleware?: readonly AnyMiddleware[]; server?: (ctx: never) => unknown } };

function flatten(middlewares: readonly AnyMiddleware[], seen = new Set<AnyMiddleware>(), out: AnyMiddleware[] = []) {
  for (const m of middlewares) {
    if (m.options.middleware) flatten(m.options.middleware, seen, out);
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

export type RunResult = { context: Record<string, unknown>; handlerCalled: boolean };

export async function runServerMiddleware(
  middlewares: readonly unknown[],
  { data, context = {}, name = "testFn" }: { data?: unknown; context?: Record<string, unknown>; name?: string } = {},
): Promise<RunResult> {
  const chain = flatten(middlewares as AnyMiddleware[]);
  let handlerCalled = false;
  const call = async (index: number, ctx: Record<string, unknown>): Promise<RunResult> => {
    const middleware = chain[index];
    if (!middleware) {
      handlerCalled = true;
      return { context: ctx, handlerCalled };
    }
    const server = middleware.options.server as ((opts: Record<string, unknown>) => Promise<unknown>) | undefined;
    if (!server) return call(index + 1, ctx);
    let result: RunResult | undefined;
    await server({
      data,
      context: ctx,
      method: "POST",
      serverFnMeta: { id: "test-id", name, filename: "tests/unit/server" },
      signal: new AbortController().signal,
      next: async (opts: { context?: Record<string, unknown> } = {}) => {
        result = await call(index + 1, { ...ctx, ...opts.context });
        return result;
      },
    });
    return result ?? { context: ctx, handlerCalled };
  };
  return call(0, { ...context });
}
