// Verifies Stripe events and applies subscription entitlements or pay-as-you-go credit.
// Deploy with verify_jwt = false. Authentication is the Stripe signature over the raw body.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  if (!signature) return new Response("Webhook signature error", { status: 400 });
  const liveStripeSecret = await resolveSecret(supabase, "STRIPE_LIVE_SECRET_KEY");
  const liveWebhookSecret = await resolveSecret(supabase, "STRIPE_LIVE_WEBHOOK_SECRET");
  const testStripeSecret = await resolveSecret(supabase, "STRIPE_TEST_SECRET_KEY") || await resolveSecret(supabase, "STRIPE_SECRET_KEY");
  const testWebhookSecret = await resolveSecret(supabase, "STRIPE_TEST_WEBHOOK_SECRET") || await resolveSecret(supabase, "STRIPE_WEBHOOK_SECRET");
  let context: WebhookContext;
  try {
    context = await resolveWebhookContext(rawBody, signature, [
      { mode: "live", stripeSecret: liveStripeSecret, webhookSecret: liveWebhookSecret },
      { mode: "test", stripeSecret: testStripeSecret, webhookSecret: testWebhookSecret },
    ]);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", (error as Error).message);
    return new Response("Webhook signature error", { status: 400 });
  }
  const { event, stripe, hasApiKey } = context;

  const { data: priorEvent } = await supabase
    .from("adelphos_stripe_events")
    .select("processing_status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (priorEvent?.processing_status === "processed") {
    return json({ received: true, duplicate: true });
  }
  await supabase.from("adelphos_stripe_events").upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    processing_status: "processing",
    last_error: null,
    received_at: new Date().toISOString(),
  }, { onConflict: "stripe_event_id" });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await applyCompletedCheckout(supabase, stripe, event.data.object as Stripe.Checkout.Session, event.livemode, hasApiKey);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscriptionChange(supabase, event.data.object as Stripe.Subscription, event.type, event.livemode);
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
        await applyInvoice(supabase, event.data.object as Stripe.Invoice, event.type, event.livemode);
        break;
    }
    await supabase.from("adelphos_stripe_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    }).eq("stripe_event_id", event.id);
    return json({ received: true });
  } catch (error) {
    const message = (error as Error).message || "Stripe event handling failed";
    console.error("Stripe webhook handler failed", event.id, message);
    await supabase.from("adelphos_stripe_events").update({
      processing_status: "failed",
      last_error: message.slice(0, 1000),
    }).eq("stripe_event_id", event.id);
    return new Response("Webhook handler error", { status: 500 });
  }
});

async function billingPlan(supabase: SupabaseClient, planCode: string) {
  const { data, error } = await supabase
    .from("adelphos_billing_plans")
    .select("code, plan_kind, price_cents, currency, stripe_price_id, stripe_lookup_key, active, is_active, metadata")
    .eq("code", planCode)
    .eq("active", true)
    .eq("is_active", true)
    .single();
  if (error || !data) throw new Error(`Stripe metadata named an unavailable plan: ${planCode}`);
  return data;
}

async function billingPlanByPrice(supabase: SupabaseClient, stripePriceId: string) {
  const { data, error } = await supabase
    .from("adelphos_billing_plans")
    .select("code, plan_kind, price_cents, currency, stripe_price_id, stripe_lookup_key, active, is_active, metadata")
    .eq("stripe_price_id", stripePriceId)
    .eq("active", true)
    .eq("is_active", true)
    .single();
  if (error || !data) throw new Error(`Stripe Price ${stripePriceId} is not in the active Adelphos catalogue.`);
  return data;
}

async function applyCompletedCheckout(
  supabase: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  livemode: boolean,
  hasApiKey: boolean,
) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    throw new Error(`Checkout session ${session.id} is not paid.`);
  }
  const email = String(session.metadata?.email || session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
  if (!email) throw new Error(`Checkout session ${session.id} has no entitlement email.`);
  const userId = String(session.metadata?.adelphos_user_id || "").trim();
  const tenantId = String(session.metadata?.adelphos_tenant_id || "").trim();
  /* A purchase made STRAIGHT from Stripe — a payment link, not the signed-in
     checkout on the website — carries none of this metadata. Rejecting it meant
     the customer paid and got nothing. Such a purchase is now honoured against
     the Stripe customer's email: the licence is created UNBOUND, and
     chat-backend/035-licence-directory binds the identity onto it the moment
     that person registers or signs in with the same address. A HALF-bound
     session is still refused — that is tampering, not a payment link. */
  const boundIdentity = Boolean(userId && tenantId);
  if (boundIdentity && session.client_reference_id !== userId) {
    throw new Error(`Checkout session ${session.id} has a mismatched Adelphos identity.`);
  }
  if (!boundIdentity && (userId || tenantId)) {
    throw new Error(`Checkout session ${session.id} has a partial Adelphos identity.`);
  }
  if (!hasApiKey) throw new Error(`Checkout session ${session.id} needs Stripe API verification but no API key is configured.`);
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  const priceId = lineItems.data[0]?.price?.id || "";
  if (lineItems.data.length !== 1 || !priceId) throw new Error(`Checkout session ${session.id} has no single configured Price.`);
  const plan = await billingPlanByPrice(supabase, priceId);
  const planCode = String(plan.code || "").trim().toLowerCase();
  if (!planCode) throw new Error(`Checkout session ${session.id} resolved to a plan without a code.`);
  const configuredMode = String(plan.metadata?.stripe_mode || "");
  if (configuredMode === "test" && livemode) throw new Error(`Plan ${planCode} is not configured for live Stripe events.`);
  if (configuredMode === "live" && !livemode) throw new Error(`Plan ${planCode} is not configured for test Stripe events.`);
  if (!plan.stripe_price_id) throw new Error(`Plan ${planCode} has no Stripe Price id.`);
  /* Metadata equality is a tamper check on OUR OWN checkout. A payment link
     sets none of it, so it is asserted only when the session claims to carry it.
     The price, currency and amount checks below still run for every purchase —
     they are what actually prove the customer paid for this plan. */
  if (boundIdentity || session.metadata?.plan_code || session.metadata?.price_lookup_key) {
    if (String(session.metadata?.plan_code || "") !== planCode || String(session.metadata?.price_lookup_key || "") !== String(plan.stripe_lookup_key || "")) {
      throw new Error(`Checkout session ${session.id} metadata does not match its Stripe Price.`);
    }
  }
  if (String(session.currency || "").toLowerCase() !== String(plan.currency || "").toLowerCase()) {
    throw new Error(`Checkout session ${session.id} has the wrong currency for ${planCode}.`);
  }
  if (Number(session.amount_total) !== Number(plan.price_cents)) {
    throw new Error(`Checkout session ${session.id} has the wrong amount for ${planCode}.`);
  }
  const ensured = boundIdentity
    ? await supabase.rpc("adelphos_bind_billing_identity", { p_email: email, p_auth_user_id: userId, p_tenant_id: tenantId })
    : await supabase.rpc("adelphos_ensure_billing_license", { p_email: email });
  if (ensured.error) throw ensured.error;
  /* A subscription bought from a payment link must still land on its plan — the
     subscription.updated event that follows keys on email or subscription id,
     and neither is set on an unbound licence yet. */
  if (!boundIdentity && plan.plan_kind === "subscription") {
    const seated = await supabase.from("adelphos_user_licenses")
      .update({ plan_code: planCode, status: "active", updated_at: new Date().toISOString() })
      .eq("email", email);
    if (seated.error) throw seated.error;
  }

  if (plan.plan_kind === "payment") {
    const grant = await supabase.rpc("adelphos_grant_usage_credit_top_up", {
      p_email: email,
      p_plan_code: planCode,
      p_checkout_session_id: session.id,
      p_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
    });
    if (grant.error) throw grant.error;
    return;
  }

  if (plan.plan_kind !== "subscription" || session.mode !== "subscription") {
    throw new Error(`Checkout session ${session.id} does not match subscription plan ${planCode}.`);
  }
  const { data: updatedLicence, error } = await supabase.from("adelphos_user_licenses").update({
    plan_code: planCode,
    status: "active",
    stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
    updated_at: new Date().toISOString(),
  }).eq("email", email).select("email").single();
  if (error) throw error;
  if (!updatedLicence?.email) throw new Error(`Checkout session ${session.id} did not update a licence row.`);
}

async function applySubscriptionChange(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
  eventType: string,
  livemode: boolean,
) {
  let email = String(subscription.metadata?.email || "").trim().toLowerCase();
  const priceId = subscription.items?.data?.[0]?.price?.id || "";
  if (!priceId) throw new Error(`Subscription ${subscription.id} has no Stripe Price.`);
  const plan = await billingPlanByPrice(supabase, priceId);
  const planCode = String(plan.code || "").trim().toLowerCase();
  if (plan.plan_kind !== "subscription") throw new Error(`Subscription ${subscription.id} names non-subscription plan ${planCode}.`);
  assertPlanMode(plan, livemode);
  const period = subscriptionPeriod(subscription);
  const status = eventType === "customer.subscription.deleted" ? "canceled" : mapSubscriptionStatus(subscription.status);
  const patch: Record<string, unknown> = {
    status,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    current_period_start: period.start ? new Date(period.start * 1000).toISOString() : null,
    current_period_end: period.end ? new Date(period.end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (status === "canceled") {
    if (!email) {
      const licence = await supabase.from("adelphos_user_licenses")
        .select("email").eq("stripe_subscription_id", subscription.id).maybeSingle();
      if (licence.error) throw licence.error;
      email = String(licence.data?.email || "").trim().toLowerCase();
    }
    if (!email) throw new Error(`Canceled subscription ${subscription.id} has no entitlement email.`);
    const reverted = await supabase.rpc("adelphos_revert_to_free_entitlement", {
      p_email: email,
      p_metadata: { stripe_subscription_id: subscription.id, stripe_event_type: eventType },
    });
    if (reverted.error) throw reverted.error;
    const cancelled = await supabase.from("adelphos_user_licenses").update({
      ...patch,
      plan_code: "free",
      status: "free",
    }).eq("email", email);
    if (cancelled.error) throw cancelled.error;
    return;
  }
  patch.plan_code = planCode;
  let query = supabase.from("adelphos_user_licenses").update(patch);
  query = email ? query.eq("email", email) : query.eq("stripe_subscription_id", subscription.id);
  const { error } = await query;
  if (error) throw error;
}

async function applyInvoice(supabase: SupabaseClient, invoice: Stripe.Invoice, eventType: string, livemode: boolean) {
  const email = String(invoice.customer_email || invoice.metadata?.email || "").trim().toLowerCase();
  if (!email) throw new Error(`Invoice ${invoice.id} has no entitlement email.`);
  const priceId = invoice.lines?.data?.map((line) => line.price?.id).find(Boolean) || "";
  if (!priceId) throw new Error(`Invoice ${invoice.id} has no Stripe Price.`);
  const plan = await billingPlanByPrice(supabase, priceId);
  const planCode = String(plan.code || "").trim().toLowerCase();
  assertPlanMode(plan, livemode);
  const { error } = await supabase.from("adelphos_invoices").upsert({
    email,
    stripe_invoice_id: invoice.id,
    amount_cents: invoice.amount_paid ?? invoice.amount_due ?? 0,
    currency: invoice.currency ?? "gbp",
    status: invoice.status ?? "open",
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    pdf_url: invoice.invoice_pdf ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_invoice_id" });
  if (error) throw error;
  if (eventType === "invoice.payment_failed") {
    const failed = await supabase.from("adelphos_user_licenses").update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    }).eq("email", email);
    if (failed.error) throw failed.error;
  } else if (plan.plan_kind === "subscription") {
    const grant = await supabase.rpc("adelphos_grant_subscription_period_credits", {
      p_email: email,
      p_plan_code: planCode,
      p_period_id: invoice.id,
      p_metadata: { stripe_invoice_id: invoice.id },
    });
    if (grant.error) throw grant.error;
  }
}

function mapSubscriptionStatus(status: string): string {
  if (status === "active" || status === "trialing") return status;
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "incomplete";
}

type StripeMode = "live" | "test";

type WebhookContext = {
  event: Stripe.Event;
  mode: StripeMode;
  stripe: Stripe;
  hasApiKey: boolean;
};

type WebhookCandidate = {
  mode: StripeMode;
  stripeSecret: string;
  webhookSecret: string;
};

type SubscriptionWithItemPeriods = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
};

async function resolveWebhookContext(rawBody: string, signature: string, candidates: WebhookCandidate[]): Promise<WebhookContext> {
  for (const candidate of candidates) {
    if (!candidate.webhookSecret) continue;
    const hasApiKey = Boolean(candidate.stripeSecret);
    const stripe = new Stripe(candidate.stripeSecret || "sk_test_webhook_signature_only", {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });
    try {
      const event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        candidate.webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
      if (event.livemode !== (candidate.mode === "live")) throw new Error("Stripe event mode does not match its signing secret.");
      return { event, mode: candidate.mode, stripe, hasApiKey };
    } catch {
      continue;
    }
  }
  throw new Error("No configured Stripe signing secret accepted the event.");
}

function assertPlanMode(plan: { code: string; metadata?: Record<string, unknown> | null }, livemode: boolean) {
  const configuredMode = String(plan.metadata?.stripe_mode || "");
  if (configuredMode === "test" && livemode) throw new Error(`Plan ${plan.code} is not configured for live Stripe events.`);
  if (configuredMode === "live" && !livemode) throw new Error(`Plan ${plan.code} is not configured for test Stripe events.`);
  if (configuredMode !== "test" && configuredMode !== "live") throw new Error(`Plan ${plan.code} has no valid Stripe mode.`);
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const periodSubscription = subscription as SubscriptionWithItemPeriods;
  const starts = (periodSubscription.items?.data || [])
    .map((item) => item.current_period_start)
    .filter((value): value is number => typeof value === "number");
  const ends = (periodSubscription.items?.data || [])
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  return {
    start: periodSubscription.current_period_start ?? (starts.length ? Math.min(...starts) : null),
    end: periodSubscription.current_period_end ?? (ends.length ? Math.max(...ends) : null),
  };
}

async function resolveSecret(supabase: SupabaseClient, key: string): Promise<string> {
  const environmentValue = Deno.env.get(key);
  if (environmentValue) return environmentValue;
  const { data } = await supabase.from("api_secrets").select("value").eq("key", key).single();
  return data?.value ?? "";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
