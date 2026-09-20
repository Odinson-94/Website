// Creates a Stripe Billing Portal Session for an authenticated Adelphos identity.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { resolveBillingCustomer } from "./010-resolve-billing-customer.ts";
import { billingPortalUrl } from "../_shared/030-billing-portal-session.ts";

const allowedOrigins = new Set([
  "https://adelphos.ai",
  "https://www.adelphos.ai",
  "https://chat.adelphos.ai",
  "http://127.0.0.1:4177",
]);

serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = origin && allowedOrigins.has(origin)
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

    const { data: licence, error: licenceError } = await supabase
      .from("adelphos_user_licenses")
      .select("stripe_customer_id, plan_code, auth_user_id, tenant_id")
      .eq("email", email)
      .single();
    const customerId = String(licence?.stripe_customer_id || "");
    if (licenceError || !customerId || licence?.auth_user_id !== userId || licence?.tenant_id !== tenantId) {
      return json({ error: "No Stripe billing account is attached to this Adelphos account." }, 404, corsHeaders);
    }

    const { data: plan } = await supabase.from("adelphos_billing_plans")
      .select("metadata")
      .eq("code", licence?.plan_code || "")
      .maybeSingle();
    const stripeMode = String(plan?.metadata?.stripe_mode || "test");
    const { stripe, mode } = await resolveBillingCustomer({
      preferredMode: stripeMode === "live" ? "live" : "test",
      customerId,
      email,
      keys: {
        live: Deno.env.get("STRIPE_LIVE_SECRET_KEY") || "",
        test: Deno.env.get("STRIPE_TEST_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_KEY") || "",
      },
      createClient: (key) => new Stripe(key, {
        apiVersion: "2024-06-20",
        httpClient: Stripe.createFetchHttpClient(),
      }),
    });
    const configurationId = Deno.env.get(mode === "live" ? "STRIPE_LIVE_BILLING_PORTAL_CONFIGURATION_ID" : "STRIPE_TEST_BILLING_PORTAL_CONFIGURATION_ID") || "";
    const url = await billingPortalUrl(stripe, customerId, mode === "live", configurationId);
    return json({ url }, 200, corsHeaders);
  } catch (error) {
    console.error("stripe-portal error", (error as Error).message);
    return json({ error: "Billing Portal could not be opened." }, 502, corsHeaders);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

type BillingIdentity = { email: string; userId: string; tenantId: string };

async function resolveIdentity(
  req: Request,
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
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
