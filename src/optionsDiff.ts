/**
 * Stable, comparison-safe serialization for option-diff detection.
 *
 * `JSON.stringify` is unsuitable as a React-effect key for the `options`
 * prop:
 *   1. object keys are emitted in insertion order, so semantically identical
 *      objects that differ only in property declaration order produce
 *      different strings (a spurious remount that discards unsaved edits, or
 *      a spurious updateOptions);
 *   2. `undefined` and function values are silently dropped, so real changes
 *      can be invisible to the diff (stale editor configuration);
 *   3. a circular reference throws at render time.
 *
 * `stableKey` returns a canonical string instead: object keys are sorted,
 * `undefined` and functions are first-class values (functions keyed by a
 * stable reference id), and circular references are emitted as a marker
 * rather than recursing forever. Equal structures always serialize to equal
 * strings, regardless of key order, without throwing.
 */

const UNDEFINED = '\uFFFCundefined';
const CIRCULAR = '\uFFFCcircular';
const SYMBOL_PREFIX = '\uFFFCsymbol:';
const FUNCTION_PREFIX = '\uFFFCfunction:';
const BIGINT_SUFFIX = 'n';

// Functions carry no comparable intrinsic value, so key them by reference:
// the same function instance is stable across renders, while a freshly
// created closure is a genuine change the diff must not miss.
const functionIds = new WeakMap<Function, number>();
let nextFunctionId = 0;

const functionId = (fn: Function): number => {
  const existing = functionIds.get(fn);
  if (existing !== undefined) return existing;
  const id = nextFunctionId++;
  functionIds.set(fn, id);
  return id;
};

const serialize = (value: unknown, path: Set<object>): string => {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
    case 'boolean':
      return String(value);
    case 'bigint':
      return `${value}${BIGINT_SUFFIX}`;
    case 'undefined':
      return UNDEFINED;
    case 'symbol':
      return `${SYMBOL_PREFIX}${String(value.description ?? '')}`;
    case 'function':
      return `${FUNCTION_PREFIX}${functionId(value)}`;
    case 'object':
      if (value === null) return 'null';
      // A node already on the active path is a cycle: emit a marker and stop
      // recursing so a circular `options` object can no longer crash render.
      if (path.has(value)) return CIRCULAR;
      path.add(value);
      let result: string;
      if (Array.isArray(value)) {
        result = `[${value.map((item) => serialize(item, path)).join(',')}]`;
      } else {
        const entries = Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(
            ([key, entry]) => `${JSON.stringify(key)}:${serialize(entry, path)}`
          )
          .join(',');
        result = `{${entries}}`;
      }
      path.delete(value);
      return result;
    /* v8 ignore next -- every typeof is handled by a case above */
    default:
      return 'null';
  }
};

/**
 * Canonical serializer for structural option diffing. See the module doc for
 * the guarantees it provides over `JSON.stringify`.
 */
export const stableKey = (value: unknown): string => {
  const path = new Set<object>();
  return serialize(value, path);
};
