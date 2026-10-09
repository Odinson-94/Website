// ADELPHOS-SESSION 2026-10-08/codex-jl-billing/9bb361ac
// Exercise the real gateway handler: exact model/rate attribution and existing admission.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.env.ADELPHOS_TYPESCRIPT_PATH || 'typescript');
const compile = name => ts.transpileModule(fs.readFileSync(path.join(__dirname, name), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modelOwner = { exports: {} };
vm.runInNewContext(compile('010-resolve-provider-model.ts'), modelOwner);
const { resolveBillingModel, SOL_MODEL, HELPER_MODELS } = modelOwner.exports;

test('Sol keeps its own identity and preserves every deployed model mapping', () => {
  for (const factor of ['standard', 'schematic', 'helper']) assert.equal(resolveBillingModel(SOL_MODEL, factor), SOL_MODEL);
  for (const model of HELPER_MODELS) assert.equal(resolveBillingModel(model, 'helper'), model);
  assert.equal(resolveBillingModel('claude-opus-4-6'), 'claude-opus-5');
  assert.equal(resolveBillingModel('unknown'), 'unknown');
  assert.equal(resolveBillingModel('  '), null);
});

for (const entry of require('./040-configured-models.json').models) for (const factor of ['standard', 'schematic', 'helper']) {
  const configuredModel = entry.model;
  const billedModel = resolveBillingModel(configuredModel, factor);
  const baseRates = entry.provider_usd_per_million;
  test(`${configuredModel} ${factor}: exact rates, quote timestamp, reservation and reported denial`, async () => {
    const queries = [], rpcs = [];
    const multiplier = {standard: 4, schematic: 20, helper: 1.1}[factor];
    let handler, allowed = true;
    const db = {
      from(table) {
        const query = {table, filters: {}}; queries.push(query);
        const chain = {
          select() { return chain; }, eq(k,v) { query.filters[k]=v; return chain; },
          lte(k,v) { query.filters[k]=v; return chain; }, order() { return chain; },
          async limit() { return {data:[{usd_per_million_units: (baseRates[query.filters.component])*multiplier,effective_until:null}]}; },
        }; return chain;
      },
      async rpc(name,args) { rpcs.push({name,args}); return {data:allowed?{allowed:true}:{allowed:false,reason:'insufficient_usage_credits'}}; },
    };
    vm.runInNewContext(compile('index.ts'), {exports:{},Request,Response,Date,console,
      Deno:{env:{get:key=>({ADELPHOS_METERING_SERVICE_TOKEN:'fixture',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'})[key]}},
      require(name) {
        if(name.includes('/http/server')) return {serve(fn){handler=fn;}};
        if(name.includes('supabase-js')) return {createClient:()=>db};
        if(name.endsWith('010-resolve-provider-model.ts')) return modelOwner.exports;
        throw Error(name);
      },
    });
    const request = () => new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture','content-type':'application/json'},body:JSON.stringify({action:'reserve',request_kind:'chat',model:configuredModel,factor_code:factor,email:'test@example.invalid',project_id:'p',request_id:'r',maximum_usage:{uncached_input:1000,cache_read:baseRates.cache_read == null ? 0 : 1000,billable_output:100}})});
    assert.equal((await handler(request())).status,200);
    assert.equal(queries.length,baseRates.cache_read == null ? 2 : 3);
    assert.ok(queries.every(q=>q.filters.model===billedModel && q.filters.factor_code===factor));
    assert.equal(rpcs[0].args.p_model,billedModel);
    assert.ok(Math.abs(rpcs[0].args.p_reserve_usage_credits-(1000*baseRates.uncached_input+1000*(baseRates.cache_read||0)+100*baseRates.billable_output)/1e6*multiplier)<1e-9);
    assert.ok(queries.every(q=>q.filters.effective_from===rpcs[0].args.p_metadata.billing_quote_at));
    allowed=false;
    const denied=await handler(request());
    assert.equal(denied.status,402);
    assert.equal((await denied.json()).reason,'insufficient_usage_credits');
  });
}
