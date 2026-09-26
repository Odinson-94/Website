// #region ADELPHOS-SESSION 2026-09-20/payment-simulation/01a0b8b9
// Simulate each supported plan through the production handler, recording the
// precise database commands. Database grants are separately proven by sandbox
// receipts; this adapter does not pretend to execute Postgres settlement.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(process.env.ADELPHOS_TYPESCRIPT_PATH);
function load(file) {
  const module = { exports: {} };
  let source = fs.readFileSync(file, 'utf8');
  if (path.basename(file) === 'index.ts') source += '\nexport { applyCompletedCheckout, applyInvoice };';
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => name.includes('/http/server.ts') ? { serve() {} } : name.startsWith('https:') ? {} : load(path.resolve(path.dirname(file), name)), module, module.exports);
  return module.exports;
}
const handlers = load(path.join(__dirname, 'index.ts'));
function fixture(code, amount, kind) {
  const identity = { email: 'simulation@example.invalid', userId: 'simulation-user', tenantId: 'simulation-company' };
  const price = { id: 'price_sim_' + code, unit_amount: amount, currency: 'gbp', livemode: false };
  const plan = { code, plan_kind: kind, stripe_price_id: price.id, stripe_lookup_key: code, price_cents: amount, currency: 'gbp', active: true, is_active: true, metadata: { stripe_mode: 'test' } };
  const licence = { email: identity.email, stripe_customer_id: 'cus_sim', stripe_subscription_id: null, stripe_state_version: 0 };
  const session = { id: 'cs_sim_' + code, customer: 'cus_sim', status: 'complete', livemode: false, payment_status: 'paid', mode: kind, currency: 'gbp', amount_subtotal: amount, amount_total: amount, total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 }, client_reference_id: identity.userId, metadata: { email: identity.email, adelphos_user_id: identity.userId, adelphos_tenant_id: identity.tenantId, plan_code: code, price_lookup_key: code }, payment_intent: 'pi_sim_' + code, subscription: kind === 'subscription' ? 'sub_sim' : null };
  const lines = { has_more: false, data: [{ price, quantity: 1, currency: 'gbp', amount_subtotal: amount, amount_total: amount, amount_discount: 0, amount_tax: 0 }] };
  const subscription = { id: 'sub_sim', customer: 'cus_sim', livemode: false, status: 'active', created: 100, current_period_start: 100, current_period_end: 200, latest_invoice: 'in_sim', metadata: { email: identity.email }, items: { data: [{ price }] } };
  const invoice = { id: 'in_sim', customer: 'cus_sim', customer_email: identity.email, livemode: false, subscription: 'sub_sim', billing_reason: 'subscription_create', status: 'paid', amount_paid: amount, currency: 'gbp', created: 100, lines: { data: [{ price, amount, period: { start: 100, end: 200 } }] } };
  const calls = [];
  const db = {
    from(table) {
      const filters = [];
      return { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, upsert(row) { calls.push({ table, row }); return this; },
        async single() { const row = table === 'adelphos_billing_plans' ? plan : licence; return { data: filters.every(([k, v]) => row[k] === v) ? { ...row } : null, error: null }; },
        async maybeSingle() { return this.single(); }, then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); } };
    },
    async rpc(name, args) { calls.push({ name, args }); return { data: { applied: true }, error: null }; },
  };
  const stripe = { checkout: { sessions: { retrieve: async () => session, listLineItems: async () => lines } }, subscriptions: { retrieve: async () => subscription }, invoices: { retrieve: async () => invoice, list: async function* () { yield invoice; } } };
  return { identity, plan, licence, session, invoice, calls, db, stripe, run: () => handlers.applyCompletedCheckout(db, stripe, { id: session.id }, false, true) };
}
for (const [code, amount, kind] of [['everyday', 2000, 'subscription'], ['standard', 5000, 'subscription'], ['business', 20000, 'subscription'], ['payg-20', 2000, 'payment']]) {
  test('SIMULATION: ' + code + ' binds the exact account and dispatches authoritative purchase', async () => {
    const f = fixture(code, amount, kind); await f.run();
    assert.deepEqual(f.calls[0], { name: 'adelphos_bind_billing_identity', args: { p_email: f.identity.email, p_auth_user_id: f.identity.userId, p_tenant_id: f.identity.tenantId } });
    const purchase = f.calls[1];
    assert.equal(purchase.name, kind === 'payment' ? 'adelphos_grant_usage_credit_top_up' : 'adelphos_apply_subscription_event_v2');
    assert.equal(purchase.args.p_plan_code, code);
    if (kind === 'payment') assert.equal(purchase.args.p_checkout_session_id, f.session.id);
    else {
      assert.equal(purchase.args.p_invoice_id, null); // Checkout alone cannot invent a paid-cycle allocation.
      f.licence.stripe_subscription_id = 'sub_sim';
      await handlers.applyInvoice(f.db, f.stripe, { id: 'in_sim' }, false);
      assert.equal(f.calls.at(-1).args.p_invoice_id, 'in_sim');
      assert.equal(f.calls.at(-1).args.p_paid_invoices[0].plan_code, code);
    }
  });
  for (const state of ['unpaid', 'open', 'expired', 'wrong-user', 'wrong-tenant']) test('SIMULATION: ' + code + ' refuses ' + state + ' before entitlement', async () => {
    const f = fixture(code, amount, kind);
    if (state === 'unpaid') f.session.payment_status = 'unpaid';
    else if (state === 'wrong-user') f.session.client_reference_id = 'foreign';
    else if (state === 'wrong-tenant') { f.plan.metadata.billing_verification = true; f.plan.metadata.verification_identity = f.identity; f.session.metadata.adelphos_tenant_id = 'foreign'; }
    else f.session.status = state;
    await assert.rejects(f.run()); assert.equal(f.calls.length, 0);
  });
}
// #endregion ADELPHOS-SESSION 01a0b8b9
