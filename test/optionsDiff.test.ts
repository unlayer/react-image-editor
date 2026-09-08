import { stableKey } from '../src/optionsDiff';

describe('stableKey', () => {
  it('produces equal keys for objects whose properties are in different order', () => {
    expect(
      stableKey({ a: { x: 1, y: { p: 2, q: 3 } }, b: 4, c: [1, 2, 3] })
    ).toBe(stableKey({ c: [1, 2, 3], b: 4, a: { y: { q: 3, p: 2 }, x: 1 } }));
  });

  it('distinguishes different values', () => {
    expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: 2 }));
    expect(stableKey('x')).not.toBe(stableKey('y'));
    expect(stableKey([1])).not.toBe(stableKey([1, 2]));
    expect(stableKey(null)).not.toBe(stableKey({}));
  });

  it('treats undefined as a first-class value so dropped fields stay visible', () => {
    // JSON.stringify omits undefined; here it must be distinguishable from
    // both an absent key and a present value.
    expect(stableKey({ a: undefined })).not.toBe(stableKey({}));
    expect(stableKey({ a: undefined })).not.toBe(stableKey({ a: 1 }));
    expect(stableKey({ a: undefined })).toBe(stableKey({ a: undefined }));
    expect(stableKey([undefined])).not.toBe(stableKey([]));
  });

  it('keys functions by reference: the same instance is stable, a new one differs', () => {
    const callback = () => {};
    expect(stableKey({ cb: callback })).toBe(stableKey({ cb: callback }));
    expect(stableKey({ cb: () => {} })).not.toBe(stableKey({ cb: () => {} }));
  });

  it('does not throw on circular references and emits a stable marker', () => {
    const first: { name: string; self?: unknown } = { name: 'a' };
    first.self = first;
    const second: { name: string; self?: unknown } = { name: 'a' };
    second.self = second;

    expect(() => stableKey(first)).not.toThrow();
    expect(stableKey(first)).toBe(stableKey(second));
    expect(stableKey(first)).not.toBe(stableKey({ name: 'b', self: first }));

    // A node already on the active path inside an array is handled too.
    const cycles: unknown[] = [1, 2];
    cycles.push(cycles);
    expect(() => stableKey(cycles)).not.toThrow();
  });

  it('serializes every primitive value type without throwing', () => {
    expect(() =>
      stableKey({
        str: 'text',
        num: 42,
        bool: false,
        big: BigInt(10),
        nil: null,
        sym: Symbol('sym'),
        bareSym: Symbol(),
        undef: undefined,
        fn: () => {},
      })
    ).not.toThrow();
  });
});
