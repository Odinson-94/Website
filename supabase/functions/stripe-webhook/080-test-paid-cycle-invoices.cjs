const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.ADELPHOS_TYPESCRIPT_PATH),cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const owner={exports:{}};cache.set(file,owner.exports);new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>load(path.resolve(path.dirname(file),name)),owner.exports,owner);return owner.exports;}
const collect=load(path.join(__dirname,'070-paid-cycle-invoices.ts')).paidCycleInvoices;
function fixture(){
 const state={subscription:{id:'sub_owner',livemode:false},customerId:'cus_owner',email:'fixture@example.invalid',start:100,end:200};
 const invoice=(id,reason,start=100)=>({id,billing_reason:reason,status:'paid',livemode:false,customer:'cus_owner',currency:'gbp',created:start,lines:{data:[{amount:100,price:{id:'price_'+id},period:{start,end:200}}]}});
 const items=[invoice('upgrade','subscription_update',150),invoice('base','subscription_cycle')];
 const stripe={invoices:{list:async function*(){yield* items;}}};
 const db={from(){let price;return {select(){return this;},eq(k,v){price=v;return this;},async single(){return {data:{code:price,plan_kind:'subscription',currency:'gbp',metadata:{stripe_mode:'test'}}};}};}};
 return {state,items,stripe,db,invoice,run(){return collect(db,stripe,state,'upgrade');}};
}
test('collects paid base before reversed-order upgrades and retains proration boundaries',async()=>{const f=fixture(),r=await f.run();assert.deepEqual(r.map(x=>[x.invoice_id,x.kind,x.start,x.end]),[['base','base',100,200],['upgrade','update',150,200]]);});
test('older periods do not enter current allowance reconciliation',async()=>{const f=fixture(),old=f.invoice('old','subscription_cycle',0);old.lines.data[0].period.end=100;f.items.push(old);assert.equal((await f.run()).length,2);});
test('missing paid base waits rather than granting full credits for a tiny upgrade payment',async()=>{const f=fixture();f.items.pop();await assert.rejects(f.run(),/paid base/);});
test('missing latest invoice waits for provider consistency',async()=>{const f=fixture();f.items.shift();await assert.rejects(f.run(),/latest invoice/);});
test('two base invoices need explicit reconciliation',async()=>{const f=fixture();f.items.push(f.invoice('second','subscription_create'));await assert.rejects(f.run(),/paid base/);});
test('incomplete line pagination is rejected',async()=>{const f=fixture();f.items[0].lines.has_more=true;await assert.rejects(f.run(),/additional line/);});
for(const [name,change] of [['mode',{livemode:true}],['owner',{customer:'cus_other'}],['status',{status:'open'}],['currency',{currency:'aud'}]])test('rejects incorrect '+name,async()=>{const f=fixture();Object.assign(f.items[0],change);await assert.rejects(f.run());});
test('partial base period is rejected',async()=>{const f=fixture();f.items[1].lines.data[0].period.start=110;await assert.rejects(f.run(),/full subscription cycle/);});
test('backdated proration before this cycle is rejected',async()=>{const f=fixture();f.items[0].lines.data[0].period.start=50;await assert.rejects(f.run(),/period does not match/);});
