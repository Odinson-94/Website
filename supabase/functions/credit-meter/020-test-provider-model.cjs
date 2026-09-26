const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require(process.env.ADELPHOS_TYPESCRIPT_PATH || 'typescript');
const compile = (name) => ts.transpileModule(fs.readFileSync(path.join(__dirname, name), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modelOwner = { exports: {} };
vm.runInNewContext(compile('010-resolve-provider-model.ts'), modelOwner);
const { resolveBillingModel, HAIKU_MODEL, CANONICAL_MODEL } = modelOwner.exports;
test('preserves canonical and existing Opus alias behavior', () => {
  assert.equal(resolveBillingModel(CANONICAL_MODEL), CANONICAL_MODEL);
  assert.equal(resolveBillingModel('claude-opus-4-6'), CANONICAL_MODEL);
});
test('Haiku retains its own billing model; unconfigured models are refused', () => {
  assert.equal(resolveBillingModel(HAIKU_MODEL), HAIKU_MODEL);
  assert.equal(resolveBillingModel('unknown'), null);
});
test('real reserve handler looks up Haiku rates and stores Haiku on the reservation', async () => {
  let handler;
  const queries = [], rpcs = [];
  const db = {
    from(table) {
      const query = { table, filters: {} }; queries.push(query);
      const chain = {
        select() { return chain; }, eq(key, value) { query.filters[key] = value; return chain; },
        lte() { return chain; }, order() { return chain; },
        async limit() { return { data: [{ usd_per_million_units: query.filters.component === 'uncached_input' ? 1.1 : 5.5, effective_until: null }] }; },
      };
      return chain;
    },
    async rpc(name, args) { rpcs.push({ name, args }); return { data: { allowed: true } }; },
  };
  vm.runInNewContext(compile('index.ts'), {
    exports: {}, Request, Response, Date, console,
    Deno: { env: { get: (key) => ({ ADELPHOS_METERING_SERVICE_TOKEN: 'fixture', SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture' })[key] } },
    require(name) {
      if (name.includes('/http/server')) return { serve(fn) { handler = fn; } };
      if (name.includes('supabase-js')) return { createClient: () => db };
      if (name.endsWith('010-resolve-provider-model.ts')) return modelOwner.exports;
      throw new Error(name);
    },
  });
  const response = await handler(new Request('https://fixture.invalid', { method: 'POST',
    headers: { authorization: 'Bearer fixture', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'reserve', request_kind: 'chat', model: HAIKU_MODEL,
      email: 'test@example.invalid', project_id: 'p', request_id: 'r', factor_code: 'helper',
      maximum_usage: { uncached_input: 1000, billable_output: 100 } }),
  }));
  assert.equal(response.status, 200);
  assert.equal(queries.length, 2);
  assert.ok(queries.every((q) => q.filters.model === HAIKU_MODEL));
  assert.ok(queries.every((q) => q.filters.factor_code === 'helper'));
  assert.equal(rpcs[0].args.p_metadata.factor_code, 'helper');
  assert.equal(rpcs[0].args.p_model, HAIKU_MODEL);
  assert.equal(rpcs[0].args.p_reserve_usage_credits, 0.00165);
});

for (const scenario of [
  { name: 'missing helper price never falls back to standard4x', model: HAIKU_MODEL, factor: 'helper', status: 400, queries: 1 },
  { name: 'unknown helper model is refused before a rate lookup', model: 'unknown-model', factor: 'helper', status: 403, queries: 0 },
  { name: 'unknown factors cannot silently change pricing', model: CANONICAL_MODEL, factor: 'unconfigured', status: 400, queries: 0 },
]) {
  test(scenario.name, async () => {
    let handler; const queries = []; let rpcCalls = 0;
    const db = { from() { const query = {}; queries.push(query); const chain = {
      select() { return chain; }, eq(k,v) { query[k] = v; return chain; }, lte() { return chain; }, order() { return chain; },
      async limit() { return { data: [] }; },
    }; return chain; }, async rpc() { rpcCalls++; return {data:{allowed:true}}; } };
    vm.runInNewContext(compile('index.ts'), { exports:{}, Request, Response, Date, console:{error(){}},
      Deno:{env:{get:(key)=>({ADELPHOS_METERING_SERVICE_TOKEN:'fixture',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'})[key]}},
      require(name) {
        if (name.includes('/http/server')) return {serve(fn){handler=fn;}};
        if (name.includes('supabase-js')) return {createClient:()=>db};
        if (name.endsWith('010-resolve-provider-model.ts')) return modelOwner.exports;
        throw Error(name);
      },
    });
    const result = await handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture','content-type':'application/json'},
      body:JSON.stringify({action:'reserve',request_kind:'chat',model:scenario.model,factor_code:scenario.factor,email:'test@example.invalid',project_id:'p',request_id:'r',maximum_usage:{uncached_input:100,billable_output:10}})}));
    assert.equal(result.status,scenario.status); assert.equal(queries.length,scenario.queries); assert.equal(rpcCalls,0);
    assert.ok(queries.every((q)=>q.factor_code==='helper'));
  });
}

for (const model of ['claude-opus-4-6','claude-opus-4-7','claude-opus-4-8','claude-sonnet-4-6','claude-sonnet-5']) {
  test(`helper ${model} keeps its own identity`, () => {
    assert.equal(resolveBillingModel(model, 'helper'), model);
    if (model !== 'claude-opus-4-6') assert.equal(resolveBillingModel(model), null);
  });
}
