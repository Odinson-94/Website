// Run with node --test; ADELPHOS_TYPESCRIPT_PATH can select the installed workspace compiler.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require(process.env.ADELPHOS_TYPESCRIPT_PATH || 'typescript');
const compiled = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '010-resolve-billing-customer.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const scope = { exports: {} };
vm.runInNewContext(compiled, scope);
const { resolveBillingCustomer } = scope.exports;
const missing = () => { throw Object.assign(new Error('missing'), { code: 'resource_missing' }); };
function fixture(testCustomer, liveCustomer) {
  const calls = [];
  return { calls, options: {
    preferredMode: 'test', customerId: 'cus_fixture', email: 'person@example.invalid',
    keys: { test: 'test-fixture', live: 'live-fixture' },
    createClient: (key) => ({ key, customers: { retrieve: async (id) => {
      calls.push({ key, id });
      const result = key === 'test-fixture' ? testCustomer : liveCustomer;
      return typeof result === 'function' ? result() : result;
    } } }),
  } };
}
const valid = (livemode) => ({ email: 'person@example.invalid', livemode });
test('uses a matching customer in the preferred environment', async () => {
  const f = fixture(valid(false), missing);
  const result=await resolveBillingCustomer(f.options);assert.equal(result.stripe.key, 'test-fixture');assert.equal(result.mode,'test');
  assert.equal(f.calls.length, 1);
});
test('internal/test plan can manage its verified live customer', async () => {
  const f = fixture(missing, valid(true));
  const result=await resolveBillingCustomer(f.options);assert.equal(result.stripe.key, 'live-fixture');assert.equal(result.mode,'live');
  assert.equal(f.calls.length, 2);
});
test('absent preferred key permits the other configured environment', async () => {
  const f = fixture(missing, valid(true)); f.options.keys.test = '';
  const result=await resolveBillingCustomer(f.options);assert.equal(result.stripe.key, 'live-fixture');assert.equal(result.mode,'live');
});
test('does not cross environments after permission or transport failures', async () => {
  const f = fixture(() => { throw Object.assign(new Error('permission denied'), { code: 'more_permissions_required' }); }, valid(true));
  await assert.rejects(resolveBillingCustomer(f.options), /permission denied/);
  assert.equal(f.calls.length, 1);
});
test('rejects a different customer email without fallback', async () => {
  const f = fixture({ ...valid(false), email: 'another@example.invalid' }, valid(true));
  await assert.rejects(resolveBillingCustomer(f.options), /does not match/);
  assert.equal(f.calls.length, 1);
});
test('rejects deleted customers and unexpected mode', async () => {
  for (const value of [{ deleted: true }, valid(true)]) {
    const f = fixture(value, valid(true));
    await assert.rejects(resolveBillingCustomer(f.options), /does not match/);
    assert.equal(f.calls.length, 1);
  }
});
test('fails when neither configured environment contains the customer', async () => {
  const f = fixture(missing, missing);
  await assert.rejects(resolveBillingCustomer(f.options), /not found/);
});
