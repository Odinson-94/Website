#!/usr/bin/env node
// #region ADELPHOS-SESSION 2026-09-20/payment-simulation/01a0b8b9
// CHANGELOG: Run the actual billing handlers against offline fixtures. This is
// simulation evidence, never a payment receipt or a production balance grant.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const suites = [
  '_shared/020-test-billing-verification.cjs',
  '_shared/040-test-billing-portal-session.cjs',
  'stripe-checkout/020-test-existing-subscription.cjs',
  'stripe-portal/020-test-billing-customer.cjs',
  'stripe-webhook/020-test-invoice-price.cjs',
  'stripe-webhook/040-test-payment-refund.cjs',
  'stripe-webhook/060-test-subscription-state.cjs',
  'stripe-webhook/080-test-paid-cycle-invoices.cjs',
  'stripe-webhook/100-test-checkout-amounts.cjs',
  'stripe-webhook/110-test-simulated-plan-checkout.cjs',
];
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) {
  console.error('Usage: node scripts/simulate-payments.cjs [--output receipt.json]');
  process.exit(2);
}
let typescript;
try { typescript = require.resolve(process.env.ADELPHOS_TYPESCRIPT_PATH || 'typescript'); }
catch { console.error('Set ADELPHOS_TYPESCRIPT_PATH to an installed TypeScript module.'); process.exit(2); }
// Do not forward service keys, browser state or database credentials to tests.
const env = { ADELPHOS_TYPESCRIPT_PATH: typescript };
for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH']) if (process.env[key]) env[key] = process.env[key];
const run = spawnSync(process.execPath, ['--require', path.join(__dirname, 'simulation-no-network.cjs'), '--test', '--test-reporter=tap', ...suites.map(file => path.join(root, 'supabase/functions', file))], { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
const tap = run.stdout || '';
const count = label => Number(tap.match(new RegExp('^# ' + label + ' (\\d+)$', 'm'))?.[1] || 0);
const passed = !run.error && run.status === 0 && count('tests') > 0 && count('fail') === 0 && count('cancelled') === 0 && count('skipped') === 0;
const receipt = {
  kind: 'OFFLINE_PAYMENT_SIMULATION', timestamp: new Date().toISOString(),
  verdict: passed ? 'PASS' : 'FAIL', tests: count('tests'), passed: count('pass'), failed: count('fail'),
  realPayment: false, networkAllowed: false, productionDataChanged: false,
  scope: 'Actual TypeScript handlers with simulated Stripe and database adapters; not browser checkout, Stripe signature delivery or durable database settlement.',
  deferred: 'Real customer payment and return/reload are the final release test, as instructed on 2026-09-20.',
  suites, runnerError: run.error?.message || null,
};
if (args[1]) {
  const output = path.resolve(args[1]);
  fs.writeFileSync(output, JSON.stringify({ ...receipt, tap, stderr: run.stderr || '' }, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
if (!passed) console.error(tap, run.stderr || '');
process.exitCode = passed ? 0 : 1;
// #endregion ADELPHOS-SESSION 01a0b8b9
