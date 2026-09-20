# Intent — stripe-portal

Open the billing portal for the bound authenticated identity. Resolve test/live customer environment independently of internal plan metadata; reject mismatched identity and preserve authentication failures.

The resolved customer environment chooses the portal configuration, regardless
of the internal/free plan's metadata. An explicit policy must be active and
mode-matched, invoice upgrades immediately, schedule decreases at renewal,
retain the paid period on cancellation and disallow account-email changes.
Absent configuration preserves the existing default management portal.

Secrets are supplied by the deployment environment; never store credentials or session URLs here.
