const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require(process.env.ADELPHOS_TYPESCRIPT_PATH);
const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '010-guard-billing-verification.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const owner = { exports: {} }; new Function('exports', 'module', source)(owner.exports, owner);
const guard = owner.exports.assertBillingVerificationIdentity;
const identity = { email: 'billing-verification@example.invalid', userId: 'fixture', tenantId: 'fixture-tenant' };
const plan = { metadata: { billing_verification: true, stripe_mode: 'test', verification_identity: identity } };
test('ordinary public plans keep their existing flow', () => guard({ metadata: { stripe_mode: 'live' } }, { email: 'customer@example.com' }, true));
test('sandbox checkout accepts only the complete fixture identity', () => guard(plan, identity, true));
for (const field of ['email', 'userId', 'tenantId']) {
  test('sandbox checkout refuses wrong ' + field, () => assert.throws(() => guard(plan, { ...identity, [field]: 'other' }, true)));
}
test('sandbox checkout refuses an incomplete binding', () => assert.throws(() => guard(plan, { email: identity.email }, true)));
test('signed invoice can verify fixture email without browser identity', () => guard(plan, { email: identity.email }));
test('sandbox invoice refuses a real account', () => assert.throws(() => guard(plan, { email: 'customer@example.com' })));
test('verification plan cannot run in live mode', () => assert.throws(() => guard({ metadata: { ...plan.metadata, stripe_mode: 'live' } }, identity)));
test('missing fixture identity fails closed', () => assert.throws(() => guard({ metadata: { billing_verification: true } }, identity)));
test('named internal chat verification account still requires its exact binding', () => {
  const internal = { ...identity, email: 'billing-chat-verification-20260917@adelphos.ai' };
  const internalPlan = { metadata: { ...plan.metadata, verification_identity: internal } };
  guard(internalPlan, internal, true);
  assert.throws(() => guard(internalPlan, { ...internal, userId: 'different' }, true));
  assert.throws(() => guard(internalPlan, { ...internal, email: 'another@adelphos.ai' }, true));
});
