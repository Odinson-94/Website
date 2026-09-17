# Intent — stripe-portal

Open the billing portal for the bound authenticated identity. Resolve test/live customer environment independently of internal plan metadata; reject mismatched identity and preserve authentication failures.

Secrets are supplied by the deployment environment; never store credentials or session URLs here.
