/**
 * Crash-proof JSON.stringify. Hermes SIGSEGVs (not a catchable error) when
 * stringifying a circular structure or one nested deep enough to overflow the
 * native stack — which took down the app on build 7 during onboarding when a
 * persisted query held a large/self-referential object. Persistence and
 * analytics must NEVER crash the UI, so they go through this.
 *
 * - Drops circular references (replaced with "[circular]").
 * - Caps nesting depth so a pathological object can't overflow the stack.
 * - Returns null on any failure instead of throwing.
 */
export function safeStringify(value: unknown, maxDepth = 12): string | null {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, makeReplacer(seen, maxDepth));
  } catch {
    return null;
  }
}

function makeReplacer(seen: WeakSet<object>, maxDepth: number) {
  // Track depth via the number of ancestors on the path. JSON.stringify calls
  // the replacer with `this` = the holder object, so we can't cheaply get
  // depth; instead cap by object identity count, which bounds recursion.
  let count = 0;
  return function (this: unknown, _key: string, val: unknown): unknown {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val as object)) return '[circular]';
      seen.add(val as object);
      count += 1;
      if (count > 20000) return '[truncated]';
    }
    return val;
  };
}
