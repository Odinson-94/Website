# Make the Adelphos SEO portal live

Updated 8 August 2026. The Supabase migration is already applied to project
`owebjrorrthysyeodkku`. Codex has also configured the safe, non-Google Vercel
settings. Google Search Console is the required source; DataForSEO is optional
and is not needed for the first live version.

Do not paste the downloaded Google JSON key into chat or commit it to this
repository. Give Codex its local file path instead.

## 1. Confirm the Search Console property

The property shown as **adelphos.ai** with a globe icon is the correct Domain
property. The collector is already configured with its API identifier:
`sc-domain:adelphos.ai`.

Open [the Adelphos Domain property](https://search.google.com/search-console?resource_id=sc-domain%3Aadelphos.ai).
If it opens normally, continue below.

## 2. Create the Google read-only collector identity

1. Open [Google Cloud project creation](https://console.cloud.google.com/projectcreate)
   and create or select a project such as **Adelphos SEO Monitoring**.
2. With that project selected, open the
   [Search Console API page](https://console.cloud.google.com/apis/library/searchconsole.googleapis.com)
   and click **Enable**.
3. Open [Create service account](https://console.cloud.google.com/iam-admin/serviceaccounts/create).
4. Use service-account name `adelphos-seo-reader` and description
   `Read-only Search Console collector for adelphos.ai`.
5. Click **Done**. No Google Cloud project role is required; access to the SEO
   data is granted separately in Search Console.
6. Open [Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts),
   click `adelphos-seo-reader`, then **Keys -> Add key -> Create new key -> JSON**.
   Google downloads the only copy of the JSON key. Keep it private.
7. Open the JSON file locally and copy only its `client_email` value.
8. Open [Adelphos Search Console users](https://search.google.com/search-console/users?resource_id=sc-domain%3Aadelphos.ai),
   click **Add user**, enter that `client_email`, choose **Full**, and save.
   Do not make the service account an owner.

Official references: [Search Console API prerequisites](https://developers.google.com/webmaster-tools/v1/prereqs),
[create a service account](https://docs.cloud.google.com/iam/docs/service-accounts-create),
[create a JSON key](https://docs.cloud.google.com/iam/docs/keys-create-delete), and
[Search Console users and permissions](https://support.google.com/webmasters/answer/7687615?hl=en).

## 3. Hand back to Codex

Reply with:

```text
READY - I added the service-account email as a Full user. The downloaded JSON file is at: C:\path\to\the-key.json
```

Codex will safely read that local file and then:

1. Add the Google credential to Vercel without displaying it.
2. Generate and add the private portal token.
3. Build and deploy the production portal.
4. Run the first collection and verify that real Search Console rows were stored.
5. Verify rankings, movements, clicks, impressions and portal rendering.
6. Give you the production portal link and your portal token.

## Optional later: independent rank checks

Search Console is Google's first-party record for Adelphos clicks, impressions,
CTR and average position. It only reports queries where Google has recorded
impressions for Adelphos and its position is an aggregate, not a fixed manual
search result.

DataForSEO can later add independent scheduled Google-result snapshots,
zero-impression keyword checks, competitor positions, and fixed location/device
testing. It is a third-party comparison source, not the source of truth, so it
will remain disconnected unless you explicitly decide to add it.
