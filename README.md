# Cloudflare KV Backup/Migration

Because Cloudflare didn't do it.

### Usage

- `pnpm i`
- Copy `.env.example` to `.env`
- Make a bearer token with read permissions for the source Workers KV at https://dash.cloudflare.com/profile/api-tokens and fill in source account info.
- Run `pnpm get-data`. Wait a billion years.

JSON files will be created in `data-get/<current timestamp>` that should be uploadable with `wrangler kv bulk put`, hopefully. See https://developers.cloudflare.com/workers/wrangler/commands/#put-1.

### Limitations

Key expiration is ignored.

Current code assumes values are binary and must be uploaded in base64 mode, because that was true for the KV store I needed this for.

### Not currently implemented

- Parallel requests, or other performance improvements (this currently takes like 1s/request, which, yikes). If one needed to do this more than once or with more than a few thousand keys it would presumably be worth trying things like doing multiple subrequests in a worker to reduce the number of roundtrips.

- Downloading the keys from a target namespace and saving only keys that do not exist in said target namespace. This could be useful for dealing with the daily 1000 write limit for the Workers free tier when migrating a database with live writes (each day, one could run a fresh query and upload ~900 keys to the target).
