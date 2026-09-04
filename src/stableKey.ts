/**
 * Deterministic serialization used to detect option changes across renders.
 *
 * `JSON.stringify` preserves key insertion order, so two deeply equal option
 * objects can serialize differently and trigger a needless remount. This
 * sorts object keys at every level, so the result depends only on content.
 *
 * Semantics otherwise mirror `JSON.stringify` (undefined/function/symbol
 * values are omitted from objects and become `null` in arrays), with two
 * deliberate differences: cycles serialize as `[Circular]` and bigints
 * serialize as strings, because `JSON.stringify` throws on both and this
 * runs during render.
 */
const serialize = (
  value: unknown,
  seen: Set<object>,
  honourToJSON = true
): string | undefined => {
  if (typeof value === 'bigint') return `"${value}"`;

  // Covers primitives, plus the omitted-value cases (undefined, function,
  // symbol) where JSON.stringify itself returns undefined.
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  const object = value as { toJSON?: () => unknown };
  if (honourToJSON && typeof object.toJSON === 'function') {
    // Dispatch toJSON exactly once and serialize its result directly, as
    // JSON.stringify does. Re-dispatching would let a toJSON that returns
    // `this` recurse until the stack overflows — during render, before the
    // cycle guard below is ever reached. Properties *inside* the result
    // still get their own dispatch, which is also what JSON.stringify does.
    return serialize(object.toJSON(), seen, false);
  }

  if (seen.has(value)) return '"[Circular]"';
  seen.add(value);

  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((item) => serialize(item, seen) ?? 'null').join(',')}]`;
  } else {
    const entries: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const serialized = serialize(
        (value as Record<string, unknown>)[key],
        seen
      );
      if (serialized !== undefined) {
        entries.push(`${JSON.stringify(key)}:${serialized}`);
      }
    }
    result = `{${entries.join(',')}}`;
  }

  seen.delete(value);
  return result;
};

/**
 * A key that is equal for deeply equal values, regardless of key order.
 */
export const stableKey = (value: unknown): string =>
  serialize(value, new Set()) ?? 'undefined';
