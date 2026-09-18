/** Explicit billing model allowlist. Preserve the legacy Opus alias mapping. */
export const CANONICAL_MODEL = "claude-opus-5";
export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const HELPER_MODELS = new Set([HAIKU_MODEL, CANONICAL_MODEL,
  "claude-opus-4-6", "claude-opus-4-7", "claude-opus-4-8",
  "claude-sonnet-4-6", "claude-sonnet-5"]);

export function resolveBillingModel(model: string, factorCode = "standard"): string | null {
  // A helper is billed at its actual model's rate, never an Opus alias.
  if (factorCode === "helper") return HELPER_MODELS.has(model) ? model : null;
  if (model === CANONICAL_MODEL || model === "claude-opus-4-6") return CANONICAL_MODEL;
  if (model === HAIKU_MODEL) return HAIKU_MODEL;
  return null;
}
