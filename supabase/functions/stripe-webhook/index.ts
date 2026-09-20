// Verifies Stripe events and applies subscription entitlements or pay-as-you-go credit.
// Deploy with verify_jwt = false. Authentication is the Stripe signature over the raw body.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { assertBillingVerificationIdentity } from "../_shared/010-guard-billing-verification.ts";
import { resolveInvoicePrice } from "./010-resolve-invoice-price.ts";
import { applyPaymentRefund } from "./030-apply-payment-refund.ts";
import { readSubscriptionState, writeSubscriptionState, stripeId } from "./050-subscription-state.ts";

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
      case "charge.refunded":
      case "refund.updated":
        if (!hasApiKey) throw new Error("Refund needs Stripe API verification.");
        await applyPaymentRefund(supabase, stripe, event.data.object, event.livemode);
        break;
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await applyCompletedCheckout(supabase, stripe, event.data.object as Stripe.Checkout.Session, event.livemode, hasApiKey);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        if (!hasApiKey) throw new Error("Subscription event needs Stripe API verification.");
        await applySubscriptionChange(supabase, stripe, event.data.object as Stripe.Subscription, event.livemode);
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
        if (!hasApiKey) throw new Error("Invoice event needs Stripe API verification.");
        await applyInvoice(supabase, stripe, event.data.object as Stripe.Invoice, event.livemode);
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
  assertBillingVerificationIdentity(plan, { email, userId, tenantId });
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
  const state = await readSubscriptionState(supabase, stripe, stripeId(session.subscription), email, livemode, true);
  if (state && state.customerId !== stripeId(session.customer)) throw new Error('Checkout subscription customer mismatch.');
  await writeSubscriptionState(supabase, state);
}

async function applySubscriptionChange(
  supabase: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  livemode: boolean,
) {
  const email = String(subscription.metadata?.email || '').trim().toLowerCase();
  const state = await readSubscriptionState(supabase, stripe, subscription.id, email, livemode);
  await writeSubscriptionState(supabase, state);
}

async function applyInvoice(supabase: SupabaseClient, stripe: Stripe, eventInvoice: Stripe.Invoice, livemode: boolean) {
  // An old payment_failed event may now refer to a paid invoice. Never regress
  // invoice history or account status from the event's earlier snapshot.
  const invoice = await stripe.invoices.retrieve(eventInvoice.id);
  if (invoice.livemode !== livemode) throw new Error('Invoice Stripe mode is invalid.');
  const email = String(invoice.customer_email || invoice.metadata?.email || "").trim().toLowerCase();
  if (!email) throw new Error(`Invoice ${invoice.id} has no entitlement email.`);
  const priceId = resolveInvoicePrice(invoice);
  const plan = await billingPlanByPrice(supabase, priceId);
  const planCode = String(plan.code || "").trim().toLowerCase();
  assertPlanMode(plan, livemode);
  assertBillingVerificationIdentity(plan, { email });
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
  if (plan.plan_kind === 'subscription') {
    const subscriptionId = stripeId(invoice.subscription ?? (invoice as any).parent?.subscription_details?.subscription);
    const state = await readSubscriptionState(supabase, stripe, subscriptionId, email, livemode);
    if (!state) return;
    if (state.customerId !== stripeId(invoice.customer)) throw new Error('Invoice subscription customer mismatch.');
    // Historical invoices remain visible, but only the current paid invoice can
    // grant an allowance. A delayed previous period must not refill this one.
    const isCurrentPaidInvoice = invoice.status === 'paid' && state.status === 'active'
      && stripeId(state.subscription.latest_invoice) === invoice.id;
    if (isCurrentPaidInvoice && state.plan.code !== planCode) throw new Error('Paid invoice and current subscription plan disagree.');
    await writeSubscriptionState(supabase, state, isCurrentPaidInvoice ? invoice.id : null);
  }
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
