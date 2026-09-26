const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require(process.env.ADELPHOS_TYPESCRIPT_PATH);
function load(file){
 const owner={exports:{}};
 let source=fs.readFileSync(file,'utf8');
 if(path.basename(file)==='index.ts')source+='\nexport {applyCompletedCheckout};';
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',js)(name=>name.includes('/http/server.ts')?{serve(){}}:name.startsWith('https:')?{}:load(path.resolve(path.dirname(file),name)),owner,owner.exports);
 return owner.exports;
}
const {verifyCheckoutAmounts}=load(path.join(__dirname,'090-verify-checkout-amounts.ts'));
const {applyCompletedCheckout}=load(path.join(__dirname,'index.ts'));
function fixture(){
 const price={id:'price_pack',unit_amount:2000,currency:'gbp',livemode:false};
 const plan={code:'pack',stripe_price_id:price.id,price_cents:2000,currency:'gbp',plan_kind:'payment',metadata:{stripe_mode:'test'}};
 const session={id:'cs_paid',status:'complete',livemode:false,payment_status:'paid',customer_email:'fixture@example.invalid',mode:'payment',currency:'gbp',amount_subtotal:2000,amount_total:2400,total_details:{amount_discount:0,amount_shipping:0,amount_tax:400},payment_intent:'pi_paid'};
 const lines={has_more:false,data:[{price,quantity:1,currency:'gbp',amount_subtotal:2000,amount_total:2400,amount_discount:0,amount_tax:400}]};
 const calls=[];
 const db={from(){return {select(){return this},eq(){return this},async single(){return {data:plan,error:null}}}},async rpc(name,args){calls.push({name,args});return {error:null}}};
 const stripe={checkout:{sessions:{retrieve:async()=>session,listLineItems:async()=>lines}}};
 return {price,plan,session,lines,calls,db,stripe};
}
function check(f){verifyCheckoutAmounts(f.session,f.lines,f.plan,false)}
test('exclusive tax is charged in addition to the catalogue item',()=>{check(fixture())});
test('inclusive tax does not increase the catalogue total',()=>{const f=fixture();f.session.amount_total=f.lines.data[0].amount_total=2000;f.session.total_details.amount_tax=f.lines.data[0].amount_tax=333;check(f)});
test('zero and mixed inclusive/exclusive taxes reconcile',()=>{for(const [total,tax] of [[2000,0],[2200,500]]){const f=fixture();f.session.amount_total=f.lines.data[0].amount_total=total;f.session.total_details.amount_tax=f.lines.data[0].amount_tax=tax;check(f)}});
test('Adaptive Pricing presentment is not mistaken for purchased credit value',()=>{const f=fixture();f.session.presentment_details={presentment_currency:'aud',presentment_amount:4692};check(f)});
for(const [name,mutate] of [
 ['wrong currency',f=>f.session.currency='aud'],
 ['line currency',f=>f.lines.data[0].currency='aud'],
 ['price currency',f=>f.price.currency='aud'],
 ['wrong Stripe mode',f=>f.price.livemode=true],
 ['different Price',f=>f.price.id='price_other'],
 ['wrong base price',f=>f.price.unit_amount=1000],
 ['wrong subtotal',f=>f.session.amount_subtotal=1000],
 ['quantity two',f=>f.lines.data[0].quantity=2],
 ['missing quantity',f=>delete f.lines.data[0].quantity],
 ['additional pages',f=>f.lines.has_more=true],
 ['additional item',f=>f.lines.data.push({...f.lines.data[0]})],
 ['discount',f=>f.session.total_details.amount_discount=100],
 ['line discount',f=>f.lines.data[0].amount_discount=100],
 ['shipping',f=>f.session.total_details.amount_shipping=100],
 ['mismatched total',f=>f.session.amount_total=2399],
 ['mismatched tax',f=>f.session.total_details.amount_tax=399],
 ['underpayment',f=>f.session.amount_total=f.lines.data[0].amount_total=1999],
 ['unexplained overpayment',f=>f.session.amount_total=f.lines.data[0].amount_total=2401],
 ['invalid tax',f=>f.session.total_details.amount_tax=f.lines.data[0].amount_tax=-1],
 ['missing totals',f=>delete f.session.total_details],
 ['fractional amount',f=>f.session.amount_total=f.lines.data[0].amount_total=2000.5],
 ['unfinished automatic tax',f=>f.session.automatic_tax={enabled:true,status:'requires_location_inputs'}],
 ['wrong purchase mode',f=>f.session.mode='subscription'],
])test(name+' is rejected',()=>{const f=fixture();mutate(f);assert.throws(()=>check(f))});
test('actual webhook grants the pack once by session identity, never by tax-inclusive total',async()=>{
 const f=fixture();await applyCompletedCheckout(f.db,f.stripe,{id:'cs_paid',amount_total:1},false,true);
 assert.equal(f.calls[1].name,'adelphos_grant_usage_credit_top_up');assert.deepEqual(f.calls[1].args,{p_email:'fixture@example.invalid',p_plan_code:'pack',p_checkout_session_id:'cs_paid',p_payment_intent_id:'pi_paid'});
});
for(const [name,change] of [['unpaid',{payment_status:'unpaid'}],['open',{status:'open'}],['wrong identity',{id:'cs_other'}],['live mode',{livemode:true}],['nonzero without payment',{payment_status:'no_payment_required'}]])test('canonical '+name+' stops entitlement despite a paid event snapshot',async()=>{
 const f=fixture();Object.assign(f.session,change);await assert.rejects(applyCompletedCheckout(f.db,f.stripe,{id:'cs_paid',payment_status:'paid'},false,true));assert.equal(f.calls.length,0);
});
test('unavailable provider and missing key cannot grant',async()=>{
 const f=fixture();f.stripe.checkout.sessions.retrieve=async()=>{throw new Error('Provider unavailable')};await assert.rejects(applyCompletedCheckout(f.db,f.stripe,{id:'cs_paid'},false,true),/Provider unavailable/);await assert.rejects(applyCompletedCheckout(f.db,f.stripe,{id:'cs_paid'},false,false),/no API key/);assert.equal(f.calls.length,0);
});
