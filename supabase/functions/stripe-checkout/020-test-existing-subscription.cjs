const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require(process.env.ADELPHOS_TYPESCRIPT_PATH);
function load(file,context={}){
 const module={exports:{}};
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','Deno',compiled)(name=>{
  if(name.includes('/http/server.ts'))return {serve:handler=>{context.handler=handler;}};
  if(name.includes('@supabase/supabase-js'))return {createClient:()=>context.db};
  if(name.includes('stripe@'))return {__esModule:true,default:Object.assign(function(){return context.stripe;},{createFetchHttpClient:()=>({})})};
  return load(path.resolve(path.dirname(file),name),context);
 },module,module.exports,{env:{get:name=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',ADELPHOS_BILLING_BRIDGE_TOKEN:'fixture-bridge',STRIPE_TEST_SECRET_KEY:'sk_test_fixture'})[name]}});
 return module.exports;
}
const {existingSubscriptionPortal}=load(path.join(__dirname,'010-existing-subscription.ts'));
function fixture(){
 const f={subscriptions:[],calls:[],customer:{email:'fixture@example.invalid',livemode:false}};
 f.stripe={customers:{retrieve:async id=>{f.calls.push(['customer',id]);return f.customer;}},subscriptions:{list:async function*(params){f.calls.push(['list',params]);for(const item of f.subscriptions)yield item;}},billingPortal:{sessions:{create:async params=>{f.calls.push(['portal',params]);return {url:'https://billing.stripe.com/p/session/test_fixture'};}}},checkout:{sessions:{create:async params=>{f.calls.push(['checkout',params]);return {url:'https://checkout.stripe.com/test_fixture'};}}}};
 f.identity={customerId:'cus_fixture',email:'fixture@example.invalid',live:false};
 f.plan={code:'standard',name:'Standard',plan_kind:'subscription',stripe_price_id:'price_standard',active:true,is_active:true,metadata:{stripe_mode:'test'}};
 f.db={rpc:async()=>({error:null}),from:table=>({select(){return this;},eq(){return this;},in(){return this;},async single(){return {data:table==='adelphos_billing_plans'?f.plan:{stripe_customer_id:'cus_fixture'},error:null};}})};
 return f;
}
const subscription=status=>({id:'sub_fixture',customer:'cus_fixture',livemode:false,status});
const portal=f=>existingSubscriptionPortal(f.stripe,f.identity);
for(const status of ['active','trialing','past_due','unpaid','incomplete','paused','future_status']){
 test(`existing ${status} subscription opens management without another purchase`,async()=>{
  const f=fixture();f.subscriptions=[subscription(status)];assert.match(await portal(f),/^https:\/\/billing\.stripe\.com\//);assert.equal(f.calls.filter(c=>c[0]==='portal').length,1);
 });
}
test('only canceled/expired history, or no history, allows initial Checkout',async()=>{
 for(const statuses of [[],['canceled'],['canceled','incomplete_expired']]){const f=fixture();f.subscriptions=statuses.map(subscription);assert.equal(await portal(f),null);assert.ok(!f.calls.some(c=>c[0]==='portal'));}
});
test('scan continues past canceled history and supports expanded customer IDs',async()=>{
 const f=fixture();f.subscriptions=[...Array.from({length:101},()=>subscription('canceled')),{...subscription('active'),customer:{id:'cus_fixture'}}];assert.ok(await portal(f));
});
test('wrong customer, mode, deleted customer or email blocks before checkout/portal',async()=>{
 for(const change of [{email:'another@example.invalid'},{livemode:true},{deleted:true}]){const f=fixture();Object.assign(f.customer,change);await assert.rejects(portal(f),/customer does not match/);assert.equal(f.calls.length,1);}
 for(const change of [{customer:'cus_other'},{livemode:true}]){const f=fixture();f.subscriptions=[{...subscription('active'),...change}];await assert.rejects(portal(f),/subscription does not match/);assert.ok(!f.calls.some(c=>c[0]==='portal'));}
});
test('provider errors and incomplete/excessive history never fall through to Checkout',async()=>{
 const f=fixture();f.stripe.subscriptions.list=async function*(){yield subscription('canceled');throw new Error('network failure');};await assert.rejects(portal(f),/network failure/);
 f.stripe.subscriptions.list=async function*(){for(let i=0;i<501;i++)yield subscription('canceled');};await assert.rejects(portal(f),/requires reconciliation/);
});
test('portal creation failure has no new-subscription fallback',async()=>{
 const f=fixture();f.subscriptions=[subscription('active')];f.stripe.billingPortal.sessions.create=async()=>{throw new Error('Portal unavailable');};await assert.rejects(portal(f),/Portal unavailable/);assert.ok(!f.calls.some(c=>c[0]==='checkout'));
});
async function invoke(f){
 load(path.join(__dirname,'index.ts'),f);
 return f.handler(new Request('https://fixture.invalid/stripe-checkout',{method:'POST',headers:{authorization:'Bearer fixture-bridge','content-type':'application/json'},body:JSON.stringify({plan_code:'standard',identity_email:'fixture@example.invalid',identity_user_id:'user_fixture',identity_tenant_id:'tenant_fixture'})}));
}
test('actual handler routes an existing subscriber to portal without creating Checkout',async()=>{
 const f=fixture();f.subscriptions=[subscription('active')];const response=await invoke(f);assert.equal(response.status,200);assert.equal((await response.json()).action,'manage_existing_subscription');assert.ok(!f.calls.some(c=>c[0]==='checkout'));
});
test('actual handler still creates subscription Checkout for a customer with terminal history',async()=>{
 const f=fixture();f.subscriptions=[subscription('canceled')];const response=await invoke(f);assert.equal(response.status,200);assert.equal(f.calls.find(c=>c[0]==='checkout')[1].mode,'subscription');
});
test('actual handler permits top-ups while subscribed and never creates another subscription',async()=>{
 const f=fixture();f.plan.plan_kind='payment';f.subscriptions=[subscription('active')];const response=await invoke(f);assert.equal(response.status,200);assert.equal(f.calls.find(c=>c[0]==='checkout')[1].mode,'payment');assert.ok(!f.calls.some(c=>c[0]==='list'||c[0]==='portal'));
});
