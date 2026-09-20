const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(process.env.ADELPHOS_TYPESCRIPT_PATH);
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const owner = { exports: {} }; cache.set(file, owner.exports);
  let source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('/index.ts')) source += '\nexport { applyInvoice, applyCompletedCheckout, applySubscriptionChange };';
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  new Function('require', 'exports', 'module', compiled.outputText)((name) => {
    if (name.includes('/http/server.ts')) return { serve() {} };
    if (name.startsWith('https:')) return {};
    return load(path.resolve(path.dirname(file), name).replaceAll('\\', '/'));
  }, owner.exports, owner);
  return owner.exports;
}
const stateApi = load(path.resolve(__dirname, '050-subscription-state.ts').replaceAll('\\', '/'));
const webhook = load(path.resolve(__dirname, 'index.ts').replaceAll('\\', '/'));
function fixture() {
  const licence = { email: 'fixture@example.invalid', stripe_subscription_id: 'sub_current', stripe_customer_id: 'cus_owner', stripe_state_version: 4 };
  const plan = { code: 'standard', plan_kind: 'subscription', stripe_price_id: 'price_standard', price_cents:5000, currency:'gbp', active: true, is_active: true, metadata: { stripe_mode: 'test' } };
  const subscription = { id: 'sub_current', customer: 'cus_owner', livemode: false, created: 20, status: 'active', current_period_start: 100, current_period_end: 200, latest_invoice: 'in_current', metadata: { email: licence.email }, items: { data: [{ price: { id: 'price_standard' } }] } };
  const invoice = { id: 'in_current', billing_reason:'subscription_cycle', created:100, customer: 'cus_owner', customer_email: licence.email, livemode: false, subscription: 'sub_current', status: 'paid', amount_paid: 5000, currency: 'gbp', lines: { data: [{ amount: 5000, price: { id: 'price_standard' }, period:{start:100,end:200} }] } };
  const calls = [], snapshots = [], reads = [];
  const f = { licence, plan, subscription, invoice, calls, snapshots, reads };
  f.stripe = {
    subscriptions: { retrieve: async id => { reads.push(id); return { ...subscription, id }; } },
    invoices: { retrieve: async () => structuredClone(invoice), list: async function*() { yield structuredClone(invoice); } },
    checkout: { sessions: { listLineItems: async () => ({ data: [{ price: { id: plan.stripe_price_id } }] }) } },
  };
  f.db = {
    from(table) {
      const filters = [];
      const query = {
        select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
        upsert(row) { snapshots.push({ table, row }); return this; },
        async maybeSingle() { const row = table === 'adelphos_user_licenses' ? f.licence : f.plan; return { data: row && filters.every(([k,v]) => row[k] === v) ? structuredClone(row) : null, error: null }; },
        async single() { return this.maybeSingle(); },
        then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); },
      }; return query;
    },
    async rpc(name, args) { calls.push({ name, args }); return { data: { applied: true }, error: null }; },
  };
  return f;
}
const read = f => stateApi.readSubscriptionState(f.db, f.stripe, 'sub_current', f.licence.email, false);

test('old subscription cancellation cannot touch the replacement licence', async () => {
  const f=fixture(); await webhook.applySubscriptionChange(f.db,f.stripe,{id:'sub_old',status:'canceled',metadata:{email:f.licence.email}},false);
  assert.equal(f.calls.length,0); assert.equal(f.reads.length,0);
});
test('delayed past_due event applies current active Stripe state',async()=>{
  const f=fixture();await webhook.applySubscriptionChange(f.db,f.stripe,{id:'sub_current',status:'past_due',metadata:{email:f.licence.email}},false);
  assert.equal(f.calls[0].args.p_status,'active');assert.equal(f.calls[0].args.p_expected_state_version,4);
});
test('snapshot taken before provider read carries its original database version',async()=>{
  const f=fixture();f.stripe.subscriptions.retrieve=async()=>{f.licence.stripe_state_version++;return f.subscription;};
  await stateApi.writeSubscriptionState(f.db,await read(f));assert.equal(f.calls[0].args.p_expected_state_version,4);
});
test('concurrent database conflict propagates for webhook retry',async()=>{
  const f=fixture();const state=await read(f);f.db.rpc=async()=>({error:new Error('state changed; retry')});
  await assert.rejects(stateApi.writeSubscriptionState(f.db,state),/retry/);
});
test('event before Checkout binding retries instead of being acknowledged',async()=>{
  const f=fixture();f.licence.stripe_subscription_id=null;await assert.rejects(read(f),/retry after Checkout/);
});
test('old Checkout cannot replace a newer subscription',async()=>{
  const f=fixture();f.stripe.subscriptions.retrieve=async id=>({...f.subscription,id,created:id==='sub_old'?10:20});
  assert.equal(await stateApi.readSubscriptionState(f.db,f.stripe,'sub_old',f.licence.email,false,true),null);
});
test('new Checkout can bind after verifying both subscription identities',async()=>{
  const f=fixture();f.stripe.subscriptions.retrieve=async id=>({...f.subscription,id,created:id==='sub_new'?30:20});
  await stateApi.writeSubscriptionState(f.db,await stateApi.readSubscriptionState(f.db,f.stripe,'sub_new',f.licence.email,false,true));
  assert.equal(f.calls[0].args.p_subscription_id,'sub_new');assert.equal(f.calls[0].args.p_expected_subscription_id,'sub_current');assert.equal(f.calls[0].args.p_allow_binding,true);
});
test('same-second duplicate purchases require review instead of silently losing the new purchase',async()=>{
  const f=fixture();await assert.rejects(stateApi.readSubscriptionState(f.db,f.stripe,'sub_new',f.licence.email,false,true),/ambiguous/);assert.equal(f.calls.length,0);
});
test('modern item periods are supported',async()=>{
  const f=fixture();delete f.subscription.current_period_start;delete f.subscription.current_period_end;
  Object.assign(f.subscription.items.data[0],{current_period_start:100,current_period_end:200});assert.equal((await read(f)).end,200);
});
for (const [name,change] of [
 ['wrong customer',{customer:'cus_other'}],['wrong mode',{livemode:true}],
 ['wrong email',{metadata:{email:'other@example.invalid'}}],['invalid period',{current_period_end:1}],
 ['incomplete items',{items:{has_more:true,data:[{price:{id:'price_standard'}}]}}],
]) test('rejects '+name+' without changing the licence',async()=>{const f=fixture();Object.assign(f.subscription,change);await assert.rejects(read(f));assert.equal(f.calls.length,0);});
test('an old failed invoice uses current paid state and grants only the latest invoice',async()=>{
  const f=fixture();await webhook.applyInvoice(f.db,f.stripe,{id:'in_current',status:'open'},false);
  assert.equal(f.snapshots[0].row.status,'paid');assert.equal(f.calls[0].args.p_status,'active');assert.equal(f.calls[0].args.p_invoice_id,'in_current');
});
test('an older paid period remains in history without resetting current credits',async()=>{
  const f=fixture();f.invoice.id='in_old';await webhook.applyInvoice(f.db,f.stripe,{id:'in_old'},false);
  assert.equal(f.snapshots[0].row.stripe_invoice_id,'in_old');assert.equal(f.calls[0].args.p_invoice_id,null);
});
test('invoice for a replaced subscription cannot change current status or credits',async()=>{
  const f=fixture();f.invoice.subscription='sub_old';await webhook.applyInvoice(f.db,f.stripe,{id:'in_current'},false);assert.equal(f.calls.length,0);
});
test('unpaid current invoice cannot grant credits',async()=>{
  const f=fixture();f.invoice.status='open';f.subscription.status='past_due';await webhook.applyInvoice(f.db,f.stripe,{id:'in_current'},false);
  assert.equal(f.calls[0].args.p_invoice_id,null);assert.equal(f.calls[0].args.p_status,'past_due');
});
test('invoice mode and customer mismatch fail closed',async()=>{
  const f=fixture();f.invoice.livemode=true;await assert.rejects(webhook.applyInvoice(f.db,f.stripe,{id:'in_current'},false),/mode/);
  f.invoice.livemode=false;f.invoice.customer='cus_other';await assert.rejects(webhook.applyInvoice(f.db,f.stripe,{id:'in_current'},false),/customer/);assert.equal(f.calls.length,0);
});
test('delayed subscription Checkout cannot reactivate a canceled subscription',async()=>{
  const f=fixture();f.subscription.status='canceled';
  await webhook.applyCompletedCheckout(f.db,f.stripe,{id:'cs_old',payment_status:'paid',customer_email:f.licence.email,currency:'gbp',amount_total:5000,customer:'cus_owner',subscription:'sub_current',mode:'subscription'},false,true);
  assert.equal(f.calls.at(-1).args.p_status,'canceled');
});
