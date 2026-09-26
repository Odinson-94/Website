# Pricing publication

Server-only bridge from verified Sales administrators to atomic central publication. Uses the existing service-role credential. Creates an immutable Stripe Price only when the retail pack total changes, then passes the verified result to the revision-checked SQL publisher. Does not create a Checkout Session, customer, charge or payment. Retried action IDs reuse the audit receipt; stale revisions fail closed.
