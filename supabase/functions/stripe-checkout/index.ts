// Creates a Stripe Checkout Session for an authenticated Adelphos identity.
// The request email, amount, Price id and return URLs are never browser-owned.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { assertBillingVerificationIdentity } from "../_shared/010-guard-billing-verification.ts";
import { existingSubscriptionPortal } from "./010-existing-subscription.ts";

const allowedOrigins = new Set([
  "https://adelphos.ai",
  "https://www.adelphos.ai",
  "https://chat.adelphos.ai",
  "http://127.0.0.1:4177",
]);

serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const corsHeaders: Record<string,string> = origin && allowedOrigins.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin",
      }
    : {};

  if (req.method === "OPTIONS") {
    return origin && allowedOrigins.has(origin)
      ? new Response("ok", { headers: corsHeaders })
      : new Response("Origin not allowed", { status: 403 });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, corsHeaders);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed." }, 403, corsHeaders);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const identity = await resolveIdentity(req, body, supabase);
    if (!identity) return json({ error: "Your Adelphos session is not valid." }, 401, corsHeaders);
    const { email, userId, tenantId } = identity;
    let planCode = String(body.plan_code || "").trim().toLowerCase();
    // Versioned Price rows remain available to old webhook receipts, but new
    // purchases always resolve the published pack through the stable alias.
    if (planCode === "payg-20" || planCode.startsWith("payg-price-")) {
      const current = await supabase.from("adelphos_report_price_catalogue").select("published_credit_plan").eq("id", true).single();
      if (current.error || !current.data?.published_credit_plan) throw new Error("Published credit price unavailable.");
      planCode = current.data.published_credit_plan;
    }
    const { data: plan, error: planError } = await supabase
      .from("adelphos_billing_plans")
      .select("code, name, plan_kind, stripe_price_id, stripe_lookup_key, active, is_active, metadata")
      .eq("code", planCode)
      .eq("active", true)
      .eq("is_active", true)
      .in("plan_kind", ["subscription", "payment"])
      .single();
    if (planError || !plan || !plan.stripe_price_id) {
      return json({ error: "Choose an available Adelphos plan." }, 400, corsHeaders);
    }
    try {
      assertBillingVerificationIdentity(plan, { email, userId, tenantId }, true);
    } catch {
      return json({ error: "This plan is not available for this account." }, 403, corsHeaders);
    }
    const stripeMode = String(plan.metadata?.stripe_mode || "test");
    if (stripeMode !== "test" && stripeMode !== "live") {
      return json({ error: "The selected Adelphos plan is not configured for Checkout." }, 503, corsHeaders);
    }
    const stripeKey = stripeMode === "live"
      ? Deno.env.get("STRIPE_LIVE_SECRET_KEY") || ""
      : Deno.env.get("STRIPE_TEST_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey || !stripeKeyMatchesMode(stripeKey, stripeMode)) {
      return json({ error: `Stripe ${stripeMode} Checkout is not configured.` }, 503, corsHeaders);
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const ensured = await supabase.rpc("adelphos_bind_billing_identity", {
      p_email: email,
      p_auth_user_id: userId,
      p_tenant_id: tenantId,
    });
    if (ensured.error) throw ensured.error;
    const { data: licence } = await supabase
      .from("adelphos_user_licenses")
      .select("stripe_customer_id")
      .eq("email", email)
      .single();

    let customerId = String(licence?.stripe_customer_id || "");
    if (!customerId) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      customerId = existing.data[0]?.id || (await stripe.customers.create({
        email,
        metadata: { adelphos_user_id: userId, adelphos_tenant_id: tenantId },
      })).id;
      const { error: customerError } = await supabase.from("adelphos_user_licenses").update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }).eq("email", email);
      if (customerError) throw customerError;
    }

    const mode = plan.plan_kind === "payment" ? "payment" : "subscription";
    if (mode === "subscription") {
      const portalUrl = await existingSubscriptionPortal(stripe, { customerId, email, live: stripeMode === "live" });
      if (portalUrl) return json({ url: portalUrl, action: "manage_existing_subscription" }, 200, corsHeaders);
    }
    const params: Stripe.Checkout.SessionCreateParams = {
      mode,
      customer: customerId,
      // Checkout collects the business name for tax IDs and the billing address.
      // Stripe requires explicit permission to save those on an existing customer.
      customer_update: { name: "auto", address: "auto" },
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      success_url: "https://chat.adelphos.ai/account/billing?checkout=success",
      cancel_url: "https://chat.adelphos.ai/account/billing?checkout=cancelled",
      client_reference_id: userId,
      metadata: {
        email,
        plan_code: plan.code,
        price_lookup_key: String(plan.stripe_lookup_key || ""),
        adelphos_user_id: userId,
        adelphos_tenant_id: tenantId,
        billing_cycle: mode === "subscription" ? "monthly" : "one_time",
        stripe_mode: stripeMode,
      },
    };
    const paymentMethodConfiguration = stripeMode === "live"
      ? Deno.env.get("STRIPE_LIVE_PAYMENT_METHOD_CONFIGURATION_ID") || ""
      : Deno.env.get("STRIPE_TEST_PAYMENT_METHOD_CONFIGURATION_ID") || "";
    if (paymentMethodConfiguration) params.payment_method_configuration = paymentMethodConfiguration;
    if (Deno.env.get("STRIPE_REQUIRE_TERMS") === "true") {
      params.consent_collection = { terms_of_service: "required" };
    }
    if (Deno.env.get("STRIPE_AUTOMATIC_TAX_ENABLED") === "true") {
      params.automatic_tax = { enabled: true };
    }
    if (mode === "subscription") {
      params.subscription_data = {
        metadata: { email, plan_code: plan.code, price_lookup_key: String(plan.stripe_lookup_key || ""), adelphos_user_id: userId, adelphos_tenant_id: tenantId, billing_cycle: "monthly" },
      };
    } else {
      params.invoice_creation = { enabled: true };
      params.payment_intent_data = {
        metadata: { email, plan_code: plan.code, price_lookup_key: String(plan.stripe_lookup_key || ""), adelphos_user_id: userId, adelphos_tenant_id: tenantId },
      };
    }

    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `adelphos-${userId}-${plan.code}-${Math.floor(Date.now() / 60000)}`,
    });
    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    return json({ url: session.url }, 200, corsHeaders);
  } catch (error) {
    console.error("stripe-checkout error", (error as Error).message);
    return json({ error: "Checkout could not be started." }, 502, corsHeaders);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function stripeKeyMatchesMode(key: string, mode: "test" | "live") {
  return mode === "live" ? /^(?:sk|rk)_live_/.test(key) : /^(?:sk|rk)_test_/.test(key);
}

type BillingIdentity = { email: string; userId: string; tenantId: string };

async function resolveIdentity(
  req: Request,
  body: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<BillingIdentity | null> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const bridgeToken = Deno.env.get("ADELPHOS_BILLING_BRIDGE_TOKEN") || "";
  if (bridgeToken && constantTimeEqual(token, bridgeToken)) {
    const email = String(body.identity_email || "").trim().toLowerCase();
    const userId = String(body.identity_user_id || "").trim();
    const tenantId = String(body.identity_tenant_id || "").trim();
    return email && userId && tenantId ? { email, userId, tenantId } : null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  const email = String(data.user?.email || "").trim().toLowerCase();
  const tenantId = String(data.user?.app_metadata?.tenant_id || data.user?.user_metadata?.tenant_id || "").trim();
  return error || !data.user || !email || !tenantId
    ? null
    : { email, userId: data.user.id, tenantId };
}

function constantTimeEqual(expected: string, supplied: string) {
  if (expected.length !== supplied.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}
