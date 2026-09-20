const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.ADELPHOS_TYPESCRIPT_PATH);
function load(file,context={}){
 const owner={exports:{}};
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','Deno',compiled)(name=>{
  if(name.includes('/http/server.ts'))return {serve:handler=>context.handler=handler};
  if(name.includes('@supabase/supabase-js'))return {createClient:()=>context.db};
  if(name.includes('stripe@'))return {__esModule:true,default:Object.assign(function(key){return context.clients[key]},{createFetchHttpClient:()=>({})})};
  return load(path.resolve(path.dirname(file),name),context);
 },owner,owner.exports,{env:{get:key=>context.env?.[key]}});return owner.exports;
}
const {billingPortalUrl}=load(path.join(__dirname,'030-billing-portal-session.ts'));
function fixture(){
 const policy={id:'bpc_test',active:true,livemode:false,features:{subscription_update:{enabled:true,default_allowed_updates:['price'],proration_behavior:'always_invoice',schedule_at_period_end:{conditions:[{type:'decreasing_item_amount'}]}},subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none'},customer_update:{enabled:true,allowed_updates:['name','address','phone']}}};
 const calls=[];const stripe={billingPortal:{configurations:{retrieve:async id=>{calls.push(['retrieve',id]);return policy}},sessions:{create:async params=>{calls.push(['create',params]);return {url:'https://billing.stripe.com/p/session/test_fixture'}}}}};return {policy,calls,stripe};
}
const run=f=>billingPortalUrl(f.stripe,'cus_fixture',false,'bpc_test');
test('explicit approved policy is pinned on the session with the trusted customer and fixed return',async()=>{
 const f=fixture();assert.match(await run(f),/^https:\/\/billing.stripe.com\//);assert.deepEqual(f.calls[1],['create',{customer:'cus_fixture',return_url:'https://chat.adelphos.ai/account/billing',configuration:'bpc_test'}]);
});
test('unconfigured environment preserves the existing management portal',async()=>{
 const f=fixture();await billingPortalUrl(f.stripe,'cus_fixture',false);assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].configuration,undefined);
});
for(const [name,change] of [
 ['wrong mode',f=>f.policy.livemode=true],['inactive',f=>f.policy.active=false],['wrong configuration',f=>f.policy.id='bpc_other'],
 ['updates disabled',f=>f.policy.features.subscription_update.enabled=false],['quantities enabled',f=>f.policy.features.subscription_update.default_allowed_updates.push('quantity')],
 ['upgrade billed later',f=>f.policy.features.subscription_update.proration_behavior='create_prorations'],
 ['immediate downgrade',f=>f.policy.features.subscription_update.schedule_at_period_end.conditions=[]],
 ['missing downgrade policy',f=>delete f.policy.features.subscription_update.schedule_at_period_end],
 ['immediate cancellation',f=>f.policy.features.subscription_cancel.mode='immediately'],
 ['cancellation proration',f=>f.policy.features.subscription_cancel.proration_behavior='always_invoice'],
 ['email changes',f=>f.policy.features.customer_update.allowed_updates.push('email')],
])test(name+' is rejected without falling back to a different policy',async()=>{const f=fixture();change(f);await assert.rejects(run(f));assert.ok(!f.calls.some(x=>x[0]==='create'))});
test('configuration retrieval failure stops session creation',async()=>{const f=fixture();f.stripe.billingPortal.configurations.retrieve=async()=>{throw new Error('Unavailable')};await assert.rejects(run(f),/Unavailable/);assert.equal(f.calls.length,0)});
test('provider must return a Stripe portal URL',async()=>{const f=fixture();f.stripe.billingPortal.sessions.create=async()=>({url:'https://other.invalid/'});await assert.rejects(run(f),/Portal URL/)});
test('management route selects live policy from resolved customer mode, not internal plan metadata or browser input',async()=>{
 const live=fixture();live.policy.id='bpc_live';live.policy.livemode=true;
 live.stripe.customers={retrieve:async()=>({email:'fixture@example.invalid',livemode:true})};
 const f={
  env:{SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture',ADELPHOS_BILLING_BRIDGE_TOKEN:'fixture',STRIPE_TEST_SECRET_KEY:'sk_test_fixture',STRIPE_LIVE_SECRET_KEY:'sk_live_fixture',STRIPE_TEST_BILLING_PORTAL_CONFIGURATION_ID:'bpc_test',STRIPE_LIVE_BILLING_PORTAL_CONFIGURATION_ID:'bpc_live'},
  clients:{sk_test_fixture:{customers:{retrieve:async()=>{throw Object.assign(new Error('missing'),{code:'resource_missing'})}}}},
  db:{from(){return {
   select(){return this},eq(){return this},
   async single(){return {data:{stripe_customer_id:'cus_fixture',plan_code:'internal',auth_user_id:'user_fixture',tenant_id:'tenant_fixture'}}},
   async maybeSingle(){return {data:{metadata:{stripe_mode:'test'}}}},
  }}},
 };
 f.clients.sk_live_fixture=live.stripe;
 load(path.join(__dirname,'../stripe-portal/index.ts'),f);
 const response=await f.handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify({identity_email:'fixture@example.invalid',identity_user_id:'user_fixture',identity_tenant_id:'tenant_fixture',configuration:'bpc_browser'})}));
 assert.equal(response.status,200);assert.equal(live.calls[0][1],'bpc_live');assert.equal(live.calls[1][1].configuration,'bpc_live');
});
