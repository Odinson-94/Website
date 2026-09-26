# Local SEO owner baseline

Owned by the isolated UI/storage harness, existing APP-seo row. No deployment.

`010-http-storage-baseline.cjs` executes the unchanged production data, session,
collection and research handlers over real loopback HTTP. The only database is
an explicitly synthetic PostgREST server. It records queries and accepted local
writes; it does not implement or prove PostgreSQL, RLS, migrations or durability.
Provider credentials are cleared and fetch rejects non-loopback destinations.
No real portal credential, cookie, service key or customer data is used.

The assertions describe current behavior before presentation changes. Passing
this baseline is not a tenant-security pass. In particular, it must expose the
shared-token/global-query behavior and replay of a copied cookie after logout.
Different synthetic identity headers are probes for ignored identity, not an
authenticated two-tenant fixture. Real membership, tenant ban, storage migration,
restart recovery and lossless rollback remain separate unmet contract items.

Run through `seo-http-storage-baseline` in the main harness. The adapter pins all
five API owners, their five repository data inputs, both migrations, the portal
and this test. Raw TAP evidence and scope limitations are retained in the main
repository. No production files are changed by this checkpoint.
