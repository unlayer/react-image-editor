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
  // The property name this value sits under, forwarded to toJSON exactly as
  // JSON.stringify does: '' at the top level, the property name inside an
  // object, the index as a string inside an array.
  key: string,
  honourToJSON = true
): string | undefined => {
  if (typeof value === 'bigint') return `"${value}"`;

  // Covers primitives, plus the omitted-value cases (undefined, function,
  // symbol) where JSON.stringify itself returns undefined.
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  // Read the property once. A toJSON defined as a getter would otherwise be
  // invoked twice — once to type-check it, once to call it — so a getter with
  // side effects, or one returning a fresh function each read, behaved
  // differently here than under JSON.stringify.
  const toJSON = honourToJSON
    ? (value as { toJSON?: (key: string) => unknown }).toJSON
    : undefined;
  if (typeof toJSON === 'function') {
    // .call, because caching the method above loses the `this` that
    // method-call syntax bound for free. JSON.stringify invokes toJSON with
    // `this` set to the value, and implementations rely on it.
    //
    // Dispatch exactly once and serialize the result directly, as
    // JSON.stringify does. Re-dispatching would let a toJSON that returns
    // `this` recurse until the stack overflows — during render, before the
    // cycle guard below is ever reached. Properties *inside* the result
    // still get their own dispatch, which is also what JSON.stringify does.
    return serialize(toJSON.call(value, key), seen, key, false);
  }

  if (seen.has(value)) return '"[Circular]"';
  seen.add(value);

  let result: string;
  if (Array.isArray(value)) {
    // An index loop, not .map(): .map() skips holes, so a sparse array
    // joined to fewer entries than its length — new Array(1) serialized as
    // '[]' and collided with a genuinely empty array. Reading value[index]
    // yields undefined for a hole, which serializes to null, matching
    // JSON.stringify.
    const items: string[] = [];
    for (let index = 0; index < value.length; index++) {
      items.push(serialize(value[index], seen, String(index)) ?? 'null');
    }
    result = `[${items.join(',')}]`;
  } else {
    const entries: string[] = [];
    for (const name of Object.keys(value).sort()) {
      const serialized = serialize(
        (value as Record<string, unknown>)[name],
        seen,
        name
      );
      if (serialized !== undefined) {
        entries.push(`${JSON.stringify(name)}:${serialized}`);
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
  serialize(value, new Set(), '') ?? 'undefined';
