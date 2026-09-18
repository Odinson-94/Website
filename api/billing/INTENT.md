# Website signup and billing handoff

Uses the same verified Chat account. Pricing choices enter the email-code login/signup UI, retain the chosen plan, then exchange a one-time, PKCE-bound code for an HttpOnly encrypted website session. Stripe Checkout receives the authenticated account identity from the server. No browser-provided email, amount or price is trusted.

The pending state cookie lasts 15 minutes to allow the 10-minute email-code flow. The issued central handoff code remains short-lived and single-use. Cookies are Secure and SameSite=Lax. Required runtime values are ADELPHOS_SITE_URL, ADELPHOS_CHAT_URL, ADELPHOS_CHECKOUT_ORIGINS, ADELPHOS_CALCULATOR_SESSION_SECRET, ADELPHOS_BILLING_FUNCTIONS_URL, ADELPHOS_BILLING_BRIDGE_TOKEN and ADELPHOS_METERING_SERVICE_TOKEN; secrets stay outside Git.

Signup links target https://chat.adelphos.ai/register. Deployment must serve the corresponding Chat release before publishing customer links.
