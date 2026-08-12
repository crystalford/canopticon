// Narrowing helper for tests.
//
// `noUncheckedIndexedAccess` makes every array index and `.find()` return
// `T | undefined`, which would otherwise force a non-null assertion on
// almost every line. `must` narrows the same way but fails with a message
// naming what was missing — so a test that breaks because a scene id was
// renamed says so, instead of throwing "cannot read property of undefined"
// three lines later.

export function must<T>(value: T | undefined | null, what = "value"): T {
  if (value === undefined || value === null) {
    throw new Error(`expected ${what} to be present, got ${String(value)}`);
  }
  return value;
}
