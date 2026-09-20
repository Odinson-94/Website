const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require(process.env.ADELPHOS_TYPESCRIPT_PATH);
const source=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'030-apply-payment-refund.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const owner={exports:{}};new Function('exports','module',source)(owner.exports,owner);
const apply=owner.exports.applyPaymentRefund;
function fixture(overrides={}) {
  const calls=[];
  const stripe={charges:{retrieve:async id=>({id,paid:true,amount:2000,currency:'gbp',livemode:false,payment_intent:'pi_own',invoice:null,...overrides})},refunds:{list:async function*(){yield {amount:500,currency:'gbp',status:'succeeded'};yield {amount:100,currency:'gbp',status:'pending'};yield {amount:500,currency:'gbp',status:'succeeded'};yield {amount:200,currency:'gbp',status:'failed'};}}};
  const db={rpc:async(name,body)=>{calls.push({name,body});return {data:{applied:true},error:null};}};
  return {calls,stripe,db};
}
test('reads canonical charge and all successful refunds instead of stale event totals',async()=>{
 const f=fixture();await apply(f.db,f.stripe,{object:'charge',id:'ch_own',amount_refunded:1},false);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'adelphos_apply_payment_refund');
 assert.deepEqual(f.calls[0].body,{p_charge_id:'ch_own',p_payment_intent_id:'pi_own',p_invoice_id:null,p_original_amount:2000,p_refunded_amount:1000,p_currency:'gbp',p_livemode:false});
});
test('refund.updated resolves its charge and subscription invoice',async()=>{
 const f=fixture({invoice:{id:'in_own'}});await apply(f.db,f.stripe,{object:'refund',charge:'ch_own'},false);
 assert.equal(f.calls[0].body.p_invoice_id,'in_own');
});
test('pending/failed refunds do not revoke credits',async()=>{
 const f=fixture();f.stripe.refunds.list=async function*(){yield {amount:100,currency:'gbp',status:'pending'};};
 assert.equal((await apply(f.db,f.stripe,{object:'charge',id:'ch_own'},false)).reason,'no_successful_refund');assert.equal(f.calls.length,0);
});
for(const [name,change] of [['wrong mode',{livemode:true}],['unpaid',{paid:false}],['missing intent',{payment_intent:null}],['invalid amount',{amount:1.5}],['excessive refund',{amount:999}]]) {
 test('rejects '+name+' before mutation',async()=>{const f=fixture(change);await assert.rejects(apply(f.db,f.stripe,{object:'charge',id:'ch_own'},false));assert.equal(f.calls.length,0);});
}
test('database refusal propagates so Stripe retries instead of acknowledging lost credits',async()=>{
 const f=fixture();f.db.rpc=async()=>({error:new Error('active reservation')});await assert.rejects(apply(f.db,f.stripe,{object:'charge',id:'ch_own'},false),/active reservation/);
});
test('unknown charge and mixed-currency refund fail closed',async()=>{
 const f=fixture();await assert.rejects(apply(f.db,f.stripe,{object:'refund'},false),/charge identity/);
 f.stripe.refunds.list=async function*(){yield {amount:100,currency:'aud',status:'succeeded'};};await assert.rejects(apply(f.db,f.stripe,{object:'charge',id:'ch_own'},false),/currency/);assert.equal(f.calls.length,0);
});
test('webhook dispatches both refund event types after signature verification',()=>{
 const index=fs.readFileSync(require('node:path').join(__dirname,'index.ts'),'utf8');
 assert.match(index,/case "charge.refunded":\s*case "refund.updated":\s*if \(!hasApiKey\)/);
 assert.match(index,/await applyPaymentRefund\(supabase, stripe, event.data.object, event.livemode\)/);
});
