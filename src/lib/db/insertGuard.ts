// src/lib/db/insertGuard.ts
// Server-only helper: validates insert payload keys against an allowlist.
// If anything unexpected is present, it throws with a clear message.

export function assertAllowedInsertKeys(
  table: string,
  payload: Record<string, unknown>,
  allowedKeys: readonly string[]
) {
  const allowed = new Set(allowedKeys);

  const keys = Object.keys(payload || {});
  const unknown = keys.filter((k) => !allowed.has(k));

  if (unknown.length > 0) {
    // Sort for stable output
    unknown.sort();
    const allowedSorted = [...allowed].sort();

    throw new Error(
      `[DB INSERT GUARD] Refusing to insert into "${table}". Unknown key(s): ${unknown.join(
        ", "
      )}\nAllowed keys: ${allowedSorted.join(", ")}`
    );
  }
}
