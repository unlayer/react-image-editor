import { stableKey } from '../src/stableKey';

it('is insensitive to object key order at every level', () => {
  const a = { projectId: 1, features: { imageEditor: { dock: 'left' } } };
  const b = { features: { imageEditor: { dock: 'left' } }, projectId: 1 };

  expect(stableKey(a)).toBe(stableKey(b));
  // The bug this exists to prevent: JSON.stringify disagrees here.
  expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
});

it('still distinguishes different values', () => {
  expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: 2 }));
  expect(stableKey({ a: 1 })).not.toBe(stableKey({ b: 1 }));
  expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: '1' }));
});

it('preserves array order', () => {
  expect(stableKey([1, 2])).not.toBe(stableKey([2, 1]));
  expect(stableKey([{ b: 1, a: 2 }])).toBe(stableKey([{ a: 2, b: 1 }]));
});

it('mirrors JSON.stringify for omitted values', () => {
  // Omitted from objects...
  expect(stableKey({ a: undefined, b: 1 })).toBe(stableKey({ b: 1 }));
  expect(stableKey({ a: () => {}, b: 1 })).toBe(stableKey({ b: 1 }));
  expect(stableKey({ a: Symbol('s'), b: 1 })).toBe(stableKey({ b: 1 }));
  // ...but null-filled in arrays, so positions do not shift.
  expect(stableKey([undefined, 1])).toBe('[null,1]');
});

it('handles primitives, null and non-finite numbers', () => {
  expect(stableKey(undefined)).toBe('undefined');
  expect(stableKey(null)).toBe('null');
  expect(stableKey('x')).toBe('"x"');
  expect(stableKey(1)).toBe('1');
  expect(stableKey(true)).toBe('true');
  expect(stableKey(NaN)).toBe('null');
});

it('serializes bigints instead of throwing', () => {
  // BigInt(), not a 1n literal: tsconfig targets es2019.
  expect(() => JSON.stringify({ a: BigInt(1) })).toThrow();
  expect(stableKey({ a: BigInt(1) })).toBe(stableKey({ a: BigInt(1) }));
  expect(stableKey({ a: BigInt(1) })).not.toBe(stableKey({ a: BigInt(2) }));
});

it('serializes cycles instead of throwing', () => {
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;

  expect(() => JSON.stringify(cyclic)).toThrow();
  expect(stableKey(cyclic)).toBe('{"a":1,"self":"[Circular]"}');
});

it('does not treat a repeated sibling as a cycle', () => {
  const shared = { a: 1 };

  expect(stableKey({ x: shared, y: shared })).toBe(
    stableKey({ x: { a: 1 }, y: { a: 1 } })
  );
});

it('honours toJSON, matching JSON.stringify', () => {
  expect(stableKey(new Date(0))).toBe(JSON.stringify(new Date(0)));
  expect(stableKey(new Date(0))).not.toBe(stableKey(new Date(1)));
});

it('does not recurse when toJSON returns this', () => {
  // Dispatching toJSON on its own result would recurse forever here, and
  // the cycle guard never runs because the toJSON branch precedes it.
  const selfish = { a: 1, toJSON: () => selfish };

  expect(() => stableKey(selfish)).not.toThrow();
  expect(stableKey(selfish)).toBe(JSON.stringify(selfish));
  expect(stableKey(selfish)).toBe('{"a":1}');
});

it('does not re-dispatch toJSON on its own result', () => {
  const chained = { toJSON: () => ({ toJSON: () => 'SECOND' }) };

  // JSON.stringify serialises the result's own keys rather than calling its
  // toJSON, so the function-valued key is dropped and this collapses to {}.
  expect(stableKey(chained)).toBe(JSON.stringify(chained));
  expect(stableKey(chained)).toBe('{}');
});

it('still dispatches toJSON for properties inside a toJSON result', () => {
  const inner = { toJSON: () => 'INNER' };
  const outer = { toJSON: () => ({ nested: inner, plain: 1 }) };

  expect(stableKey(outer)).toBe(JSON.stringify(outer));
  expect(stableKey(outer)).toBe('{"nested":"INNER","plain":1}');
});
