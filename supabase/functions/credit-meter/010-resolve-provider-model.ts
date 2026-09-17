/** Explicit billing model allowlist. Preserve the legacy Opus alias mapping. */
export const CANONICAL_MODEL = "claude-opus-5";
export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export function resolveBillingModel(model: string): string | null {
  if (model === CANONICAL_MODEL || model === "claude-opus-4-6") return CANONICAL_MODEL;
  if (model === HAIKU_MODEL) return HAIKU_MODEL;
  return null;
}
