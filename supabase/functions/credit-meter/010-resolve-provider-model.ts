/** Exact billing identity resolution. Rate-card rows determine admission. */
export const CANONICAL_MODEL = "claude-opus-5";
export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
// Compatibility exports only; effective rates determine admission.
export const JASON_MODELS = new Set(["gpt-5.6-sol", "gpt-6-sol", "gpt-6-astra"]);
export const HELPER_MODELS = new Set([...JASON_MODELS, HAIKU_MODEL, CANONICAL_MODEL,
  "claude-opus-4-6", "claude-opus-4-7", "claude-opus-4-8",
  "claude-sonnet-4-6", "claude-sonnet-5"]);

// #region ADELPHOS-SESSION 2026-10-08/codex-jl-billing/9bb361ac
// what: accept Jason's Sol model at its own configured rate for every billing factor.
// why: live Jason used Sol while this gateway denied every non-exempt primary turn.
// CHANGELOG 2026-10-08: exact Sol identity; existing Opus and helper behavior retained.
export const SOL_MODEL = "gpt-5.6-sol";
// #endregion ADELPHOS-SESSION 9bb361ac

// #region ADELPHOS-SESSION 2026-10-09/codex-model-billing/74d61b2e
// what: resolve compatibility aliases; effective-dated rate rows own model admission.
// why: another hardcoded list caused valid Chat/helper models to disagree with billing.
// CHANGELOG 2026-10-09: model-specific rate lookups still refuse missing prices before reserve.
export function resolveBillingModel(model: string, factorCode = "standard"): string | null {
  const exact = model.trim();
  if (!exact) return null;
  if (factorCode !== "helper" && exact === "claude-opus-4-6") return CANONICAL_MODEL;
  return exact;
}
// #endregion ADELPHOS-SESSION 74d61b2e
