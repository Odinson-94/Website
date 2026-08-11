# Connect Google Keyword Planner

The portal already works with Search Console and the 441-phrase Adelphos research inventory. This optional connection fills missing country-specific monthly volumes and adds related Google keyword ideas. It does not require DataForSEO and does not expose credentials to the browser.

## What Jason needs to do

1. Open the existing `adelphos-seo-reader` Cloud project and [enable the Google Ads API](https://console.cloud.google.com/apis/library/googleads.googleapis.com?project=adelphos-seo-reader).
2. Open or create a [Google Ads manager account](https://ads.google.com/home/tools/manager-accounts/). A real Google Ads customer account must sit under it; no campaign spend is required for the API connection itself.
3. In Google Ads, open **Admin → Access and security → Users**, then invite this exact service-account email with Standard access:

   `adelphos-seo-reader@adelphos-seo-reader.iam.gserviceaccount.com`

4. In the manager account, open **Admin → API Center**. Copy the developer token and apply for **Basic Access** if it is still in Explorer Access. State the permissible use as keyword research/recommendations for Adelphos. Google restricts Keyword Planner API calls under Explorer Access.
5. Add these server-only variables in the [Adelphos Vercel project settings](https://vercel.com/adelphosai/website/settings/environment-variables), for Production, Preview and Development:

   - `GOOGLE_ADS_DEVELOPER_TOKEN` — the token from API Center
   - `GOOGLE_ADS_CUSTOMER_ID` — the ten-digit Ads account ID, digits only
   - `GOOGLE_ADS_LOGIN_CUSTOMER_ID` — the manager account ID, digits only; omit only if no manager account is used
   - `GOOGLE_ADS_API_VERSION` — `v25`
   - `GOOGLE_ADS_MARKETS` — `AU,CA,GB,IE,IN,NZ,SG,AE,US`

6. Tell Codex only the customer ID and manager customer ID. Do not paste the developer token into chat. Once the token is present in Vercel, Codex can redeploy and press **Refresh Google ideas** in the private portal.

## What the portal then does

- Lets the portal user choose Australia, Canada, the United Kingdom, Ireland, India, New Zealand, Singapore, the UAE and the United States.
- Requests historical metrics for every research phrase in the selected countries.
- Requests up to 1,000 additional site-related ideas per selected market from `adelphos.ai`.
- Caches the results privately in Supabase so normal portal loads do not consume Google Ads API quota.
- Shows average monthly searches, monthly history in storage, Google Ads competition, current Search Console position, movement, and opportunity score.

Google Ads “competition” describes advertiser competition; it is not organic SEO difficulty. Search Console remains the authority for Adelphos clicks, impressions, average position and country. A separate SERP provider is still required for an anonymous, point-in-time Google rank check because neither Search Console nor Keyword Planner provides that test.

Official references: [Keyword ideas](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas), [historical metrics](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics), [service-account authentication](https://developers.google.com/google-ads/api/docs/oauth/service-accounts), [API access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels).
