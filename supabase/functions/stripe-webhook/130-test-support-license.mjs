import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySupportEvent } from './120-apply-support-license.ts';
function fixture() {
  const subscription = { id: 'sub_support', livemode: false, status: 'active', current_period_end: 2000000000, cancel_at_period_end: false, metadata: { app_addon: 'support', adelphos_user_id: 'owner', email: 'owner@example.com', plan_code: 'support-test' }, items: { data: [{ price: { id: 'price_support' } }] }, latest_invoice: { paid: true } };
  const plan = { code: 'support-test', stripe_price_id: 'price_support', metadata: { app_addon: 'support', stripe_mode: 'test' } };
  const writes = [];
  const supabase = { from(table) { assert.ok(['adelphos_billing_plans','adelphos_user_licenses'].includes(table)); return { select() { return this; }, eq() { return this; }, async single() { return { data: table === 'adelphos_billing_plans' ? plan : { auth_user_id: 'owner' } }; } }; }, async rpc(name, data) { assert.equal(name,'adelphos_record_support_license'); writes.push(data.p_record); return {}; } };
  const stripe = { subscriptions: { retrieve: async () => subscription } };
  const event = { type: 'customer.subscription.updated', livemode: false, data: { object: subscription } };
  return { subscription, plan, writes, supabase, stripe, event, run: () => applySupportEvent(supabase,stripe,event) };
}
test('paid Support grants a separate app licence and never updates base subscription or credits', async () => { const f=fixture();assert.equal(await f.run(),true);assert.equal(f.writes[0].status,'active');assert.equal(f.writes[0].user_id,'owner'); });
for(const status of ['past_due','unpaid','canceled','incomplete','trialing','paused']) test(`${status} Support cannot grant paid access`, async()=>{const f=fixture();f.subscription.status=status;await f.run();assert.notEqual(f.writes[0].status,'active');assert.equal(f.writes[0].paid_through,null);});
test('an active subscription without a paid invoice grants no access',async()=>{const f=fixture();f.subscription.latest_invoice.paid=false;await f.run();assert.equal(f.writes[0].status,'unpaid');});
test('cancel-at-period-end retains paid access until its recorded expiry',async()=>{const f=fixture();f.subscription.cancel_at_period_end=true;await f.run();assert.equal(f.writes[0].status,'active');assert.equal(f.writes[0].cancel_at_period_end,true);});
test('replayed paid event reads current cancellation rather than reactivating old state',async()=>{const f=fixture();f.event={type:'invoice.paid',livemode:false,data:{object:{subscription:'sub_support',subscription_details:{metadata:{app_addon:'support'}}}}};f.subscription.status='canceled';await applySupportEvent(f.supabase,f.stripe,f.event);assert.equal(f.writes[0].status,'canceled');});
test('modern invoice parent metadata routes to Support',async()=>{const f=fixture();await applySupportEvent(f.supabase,f.stripe,{type:'invoice.paid',livemode:false,data:{object:{parent:{subscription_details:{subscription:'sub_support',metadata:{app_addon:'support'}}}}}});assert.equal(f.writes.length,1);});
for(const change of [f=>{f.subscription.metadata.adelphos_user_id='other';},f=>{f.plan.metadata.stripe_mode='live';},f=>{f.plan.stripe_price_id='other';},f=>{f.subscription.metadata.email='';},f=>{f.event.livemode=true;},f=>{f.subscription.items.data.push({price:{id:'extra'}});}]) test('invalid identity, price or payment mode cannot grant Support',async()=>{const f=fixture();change(f);await assert.rejects(f.run());assert.equal(f.writes.length,0);});
test('ordinary subscription events fall through without extra Stripe calls',async()=>{const f=fixture();f.subscription.metadata.app_addon='';f.stripe.subscriptions.retrieve=async()=>{throw new Error('must not call');};assert.equal(await f.run(),false);});
test('ordinary invoices fall through without changing the app licence',async()=>{const f=fixture();assert.equal(await applySupportEvent(f.supabase,f.stripe,{type:'invoice.paid',data:{object:{subscription:'sub_base'}}}),false);assert.equal(f.writes.length,0);});
test('a persistence error fails webhook processing for Stripe retry',async()=>{const f=fixture();f.supabase.rpc=async()=>({error:new Error('database')});await assert.rejects(f.run(),/database/);});
