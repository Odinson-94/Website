// Server-only Usage Credit gateway shared by Chat, Website tools, API and CLI.
// Deploy with verify_jwt=false; ADELPHOS_METERING_SERVICE_TOKEN is the authority.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CANONICAL_MODEL, resolveBillingModel } from "./010-resolve-provider-model.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const expected = Deno.env.get("ADELPHOS_METERING_SERVICE_TOKEN") || "";
  const supplied = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !constantTimeEqual(expected, supplied)) {
    return json({ error: "Metering service authentication failed." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Metering service is not configured." }, 503);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await req.json();
    const action = text(body.action);
    if (action === "usage_history") {
      const days = Number(body.days);
      if (![7, 30, 180].includes(days)) throw new Error("Unsupported reporting period.");
      const { data, error } = await supabase.rpc("adelphos_read_usage_credit_history", {
        p_email: required(body.email, "email"), p_days: days,
      });
      if (error) throw error;
      return json(data, 200);
    }
    if (action === "issue_handoff") {
      const { data, error } = await supabase.rpc("adelphos_issue_billing_handoff", {
        p_code: required(body.code, "code"),
        p_email: required(body.email, "email"),
        p_auth_user_id: required(body.user_id, "user_id"),
        p_tenant_id: required(body.tenant_id, "tenant_id"),
        p_return_origin: required(body.return_origin, "return_origin"),
        p_state: required(body.state, "state"),
        p_pkce_challenge: required(body.pkce_challenge, "pkce_challenge"),
      });
      if (error) throw error;
      return json({ issued: data === true }, 200);
    }
    if (action === "consume_handoff") {
      const { data, error } = await supabase.rpc("adelphos_consume_billing_handoff", {
        p_code: required(body.code, "code"),
        p_state: required(body.state, "state"),
        p_pkce_verifier: required(body.pkce_verifier, "pkce_verifier"),
        p_return_origin: required(body.return_origin, "return_origin"),
      });
      if (error) throw error;
      return json(data, 200);
    }
    if (action === "project") {
      const { data, error } = await supabase.rpc("adelphos_create_billing_project", {
        p_email: required(body.email, "email"),
        p_project_id: required(body.project_id, "project_id"),
        // An omitted name reactivates the project without replacing its real name.
        p_name: text(body.name),
      });
      if (error) throw error;
      return json(data, 200);
    }
    if (action === "close_project") {
      const { data, error } = await supabase.rpc("adelphos_close_billing_project", {
        p_email: required(body.email, "email"),
        p_project_id: required(body.project_id, "project_id"),
      });
      if (error) throw error;
      return json(data, 200);
    }
    if (action === "reserve") {
      const requestKind = text(body.request_kind);
      if (requestKind !== "chat" && requestKind !== "tool") throw new Error("request_kind must be chat or tool.");
      const requestedModel = text(body.model || CANONICAL_MODEL);
      const factorCode = text(body.factor_code) || "standard";
      const billingModel = resolveBillingModel(requestedModel, factorCode);
      if (!billingModel) return json({ allowed: false, reason: "canonical_model_required" }, 403);
      const toolCode = text(body.tool_code);
      // Which usage factor prices this request. Absent = 'standard', so a caller
      // that has not been taught about factors keeps its existing behaviour.
      if (!["standard", "schematic", "helper"].includes(factorCode)) {
        return json({ allowed: false, reason: "usage_factor_not_configured" }, 400);
      }
      if (factorCode === "helper" && requestedModel !== billingModel) {
        return json({ allowed: false, reason: "exact_helper_model_required" }, 403);
      }
      let reservation = 0;
      let reservationMetadata: Record<string, unknown> = {};
      if (requestKind === "tool") {
        if (!toolCode) throw new Error("tool_code is required for a tool reservation.");
        reservation = await configuredToolRate(supabase, toolCode);
        reservationMetadata = { reservation_basis: "exact_tool_rate", tool_code: toolCode };
      } else {
        const maximumUsage = object(body.maximum_usage);
        const components = [
          ["uncached_input", nonNegativeInteger(maximumUsage.uncached_input)],
          ["cache_write_5m", nonNegativeInteger(maximumUsage.cache_write_5m)],
          ["cache_write_1h", nonNegativeInteger(maximumUsage.cache_write_1h)],
          ["cache_read", nonNegativeInteger(maximumUsage.cache_read)],
          ["billable_output", nonNegativeInteger(maximumUsage.billable_output)],
        ] as const;
        const maxOutputUnits = components
          .filter(([component]) => component === "billable_output")
          .reduce((sum, [, units]) => sum + units, 0);
        if (maxOutputUnits <= 0) throw new Error("maximum_usage must include a positive bounded output budget.");
        for (const [component, units] of components) {
          if (!units) continue;
          reservation += (units * await configuredProviderRate(supabase, component, "standard", factorCode, billingModel)) / 1_000_000;
        }
        const maximumToolCalls = Array.isArray(body.maximum_tool_calls) ? body.maximum_tool_calls : [];
        for (const item of maximumToolCalls) {
          const call = object(item);
          const code = required(call.tool_code, "maximum_tool_calls.tool_code");
          const quantity = Math.max(nonNegativeInteger(call.quantity), 1);
          reservation += await configuredToolRate(supabase, code) * quantity;
        }
        reservation = positiveDecimal(Number(reservation.toFixed(9)), "derived worst-case reservation");
        reservationMetadata = {
          reservation_basis: "provider_worst_case",
          max_output_units: maxOutputUnits,
          maximum_usage: Object.fromEntries(components),
          maximum_tool_calls: maximumToolCalls,
        };
      }
      const { data, error } = await supabase.rpc("adelphos_reserve_credits", {
        p_email: required(body.email, "email"),
        p_project_id: required(body.project_id, "project_id"),
        p_request_id: required(body.request_id, "request_id"),
        p_request_kind: requestKind,
        p_model: billingModel,
        p_reserve_usage_credits: reservation,
        // factor_code rides the reservation metadata: adelphos_settle_credits
        // reads it back so the charge uses the same multiplier as the hold.
        p_metadata: { ...object(body.metadata), ...reservationMetadata, factor_code: factorCode },
      });
      if (error) throw error;
      return json(data, data?.allowed === true ? 200 : 402);
    }
    if (action === "receipt") {
      // Same server-only authority as reserve/settle. No browser access token
      // can read another account's ledger through this endpoint.
      const { data, error } = await supabase.from("adelphos_credit_ledger")
        .select("component,provider_units,rate_usd_per_million,usage_credits,rate_code")
        .eq("request_id", required(body.request_id, "request_id")).eq("event_type", "settle");
      if (error) throw error;
      return json({ components: data || [] }, 200);
    }
    if (action === "settle") {
      const usage = object(body.usage);
      const { data, error } = await supabase.rpc("adelphos_settle_credits", {
        p_request_id: required(body.request_id, "request_id"),
        p_uncached_input: nonNegativeInteger(usage.uncached_input),
        p_cache_write_5m: nonNegativeInteger(usage.cache_write_5m),
        p_cache_write_1h: nonNegativeInteger(usage.cache_write_1h),
        p_cache_read: nonNegativeInteger(usage.cache_read),
        p_billable_output: nonNegativeInteger(usage.billable_output),
        // Anthropic output_tokens already includes extended-thinking tokens.
        p_reasoning_output: 0,
        p_tool_calls: Array.isArray(body.tool_calls) ? body.tool_calls : [],
        p_metadata: object(body.metadata),
      });
      if (error) throw error;
      return json(data, 200);
    }
    if (action === "release") {
      const { data, error } = await supabase.rpc("adelphos_release_credit_reservation", {
        p_request_id: required(body.request_id, "request_id"),
        p_reason: required(body.reason, "reason"),
      });
      if (error) throw error;
      return json(data, 200);
    }
    if (action === "forfeit") {
      const { data, error } = await supabase.rpc("adelphos_forfeit_credit_reservation", {
        p_request_id: required(body.request_id, "request_id"),
        p_reason: required(body.reason, "reason"),
      });
      if (error) throw error;
      return json(data, 200);
    }
    if (action === "dashboard") {
      const { data, error } = await supabase.rpc("adelphos_get_credit_dashboard", {
        p_email: required(body.email, "email"),
      });
      if (error) throw error;
      return json(data, 200);
    }
    return json({ error: "Unknown metering action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("credit-meter error", message);
    const failure = publicFailure(message);
    if (failure) return json({ error: failure.error, reason: failure.reason }, failure.status);
    return json({ error: "Usage Credit operation failed." }, 400);
  }
});

function publicFailure(message: string): { error: string; reason: string; status: number } | null {
  const cases: Array<[RegExp, string, string, number]> = [
    [/Project limit reached/i, "active_project_limit", "You have reached the active project limit. Close a project or wait for an inactive slot to be released.", 402],
    [/active Usage Credit reservations/i, "project_active_reservation", "This project still has work in progress. Wait for it to finish before closing the project.", 409],
    [/Project not found/i, "project_not_found", "That project could not be found in this Adelphos account.", 404],
    [/Project identity belongs to another account/i, "project_identity_conflict", "That project belongs to another Adelphos account.", 409],
    [/No active Adelphos plan/i, "plan_unavailable", "No active Adelphos plan is available for this account.", 402],
  ];
  const match = cases.find(([pattern]) => pattern.test(message));
  return match ? { reason: match[1], error: match[2], status: match[3] } : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

function positiveDecimal(value: unknown, name: string): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) throw new Error(`${name} must be positive.`);
  return result;
}

function nonNegativeInteger(value: unknown): number {
  const result = Number(value || 0);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Provider units must be non-negative integers.");
  return result;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function configuredToolRate(supabase: ReturnType<typeof createClient>, toolCode: string): Promise<number> {
  const now = new Date();
  const { data, error } = await supabase.from("adelphos_tool_rate_card")
    .select("usage_credit_per_call,effective_until")
    .eq("tool_code", toolCode).eq("active", true).lte("effective_from", now.toISOString())
    .order("effective_from", { ascending: false }).limit(20);
  let row = data?.find((candidate) => !candidate.effective_until || new Date(candidate.effective_until) > now);
  if (!row && !error && toolCode !== "__default_agent_tool__") {
    const fallback = await supabase.from("adelphos_tool_rate_card")
      .select("usage_credit_per_call,effective_until")
      .eq("tool_code", "__default_agent_tool__").eq("active", true).lte("effective_from", now.toISOString())
      .order("effective_from", { ascending: false }).limit(20);
    if (fallback.error) throw fallback.error;
    row = fallback.data?.find((candidate) => !candidate.effective_until || new Date(candidate.effective_until) > now);
  }
  if (error || !row) throw new Error(`No active Usage Credit rate is configured for ${toolCode}.`);
  return positiveDecimal(row.usage_credit_per_call, "configured tool rate");
}

/**
 * The rate for one component under one usage factor.
 *
 * A factor is a multiplier on MEASURED usage, carried as the rate itself — the
 * caller multiplies actual consumed units by what this returns, so a run twice
 * the size costs twice as much under any factor. Nothing here is a fixed price
 * per call. `standard` is 4x list; `schematic` is 20x; `helper` is 1.10x.
 *
 * Preserve the existing schematic fallback. Helpers require their own complete
 * rate card: missing helper prices fail closed, never fall back to 4x rates.
 */
async function configuredProviderRate(
  supabase: ReturnType<typeof createClient>,
  component: string,
  contextClass: "standard",
  factorCode = "standard",
  model = CANONICAL_MODEL,
): Promise<number> {
  const now = new Date();
  const usable = (rows: { usd_per_million_units: unknown; effective_until: string | null }[] | null) =>
    rows?.find((candidate) => !candidate.effective_until || new Date(candidate.effective_until) > now);

  const query = (factor: string) => supabase.from("adelphos_provider_rate_card")
    .select("usd_per_million_units,effective_until")
    .eq("model", model).eq("component", component).eq("context_class", contextClass)
    .eq("factor_code", factor)
    .eq("active", true).lte("effective_from", now.toISOString())
    .order("effective_from", { ascending: false }).limit(20);

  const { data, error } = await query(factorCode);
  let row = error ? undefined : usable(data);
  if (!row && !error && factorCode === "schematic") {
    const fallback = await query("standard");
    row = fallback.error ? undefined : usable(fallback.data);
  }
  if (!row) throw new Error(`No active provider rate is configured for ${component}.`);
  return positiveDecimal(row.usd_per_million_units, "configured provider rate");
}

function constantTimeEqual(expected: string, supplied: string): boolean {
  if (expected.length !== supplied.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
