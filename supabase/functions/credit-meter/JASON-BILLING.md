# Jason chat and drawing billing

The Website repository owns the `credit-meter` function and the Supabase rate card. Chat and Domain send authenticated usage here; the provider API key stays on their servers. A new key does not need a separate price record.

The 2026-09-26 migration adds exact identities for the three models currently configured by Jason (`gpt-5.6-sol`, `gpt-6-sol`, `gpt-6-astra`). It preserves the existing standard 4x, schematic 20x and helper 1.10x policies. Drawing helpers use helper pricing. Provider reasoning tokens are already included in output and must not be charged a second time; cached input must be subtracted from uncached input.

Rates are standard-processing, short-context prices from https://developers.openai.com/api/docs/pricing (checked 2026-09-26). This change retains the existing meter's `standard` context contract. It does not implement long-context or Fast-mode pricing; callers needing those tiers require separate context-aware pricing before enabling them. The current drawing requests use standard processing. GPT-5.6 Sol's promotional rates are guaranteed at least through 2026-11-21 and must be reviewed against the provider's next published pricing change.

Apply `20260926010000_enable_jason_provider_rates.sql` before deploying the matching `credit-meter` function, then deploy the Chat/Domain consumers. The migration refuses pre-existing model rows, concurrent rate changes and an unexpected reservation function, rather than overwriting them. It adds the new products to Sales pricing while preserving existing draft edits and historical rate rows.

Verification:

- `ADELPHOS_TYPESCRIPT_PATH=/path/to/typescript node --test supabase/functions/credit-meter/020-test-provider-model.cjs`
- `ADELPHOS_PGLITE_PATH=/path/to/@electric-sql/pglite node --test supabase/functions/credit-meter/030-test-jason-rate-migration.cjs`
- After deployment, call the server-only `pricing_quote` action for each configured model and factor and compare its effective prices with the migration. Then exercise reserve/settle on an approved billing test account. An exempt owner's successful API run proves the application workflow, not a customer debit.

Do not print service tokens, API keys or raw provider errors in the browser. User-facing errors and model labels belong to the Jason/Adelphos presentation layer.
