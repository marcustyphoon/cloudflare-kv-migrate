# Cloudflare KV Backup/Migration

This fetches every key-value pair in a Cloudflare Workers KV namespace using the REST API and saves the result as local JSON. At time of writing, KV ([unlike Cloudflare's D1 product](https://developers.cloudflare.com/d1/build-with-d1/import-export-data/#export-an-existing-d1-database)) has no bulk exfiltration method or method to migrate a namespace to another account.

At two request roundtrips per key, this is fairly inefficient.

### Usage

- `pnpm i`
- Copy `.env.example` to `.env`
- Make a bearer token with read permissions for the source Workers KV at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) and fill in source account info.
- Run `pnpm get-data`. Wait a billion years.

JSON file(s) will be created in `data-get/<current timestamp>` that should be compatible with the `wrangler kv bulk put`/`wrangler kv:bulk put` upload command to migrate/restore. See [cloudflare documentation](https://developers.cloudflare.com/workers/wrangler/commands/#put-1).

### Limitations

Key expiration is ignored.

Current code assumes values are binary and must be uploaded in base64 mode, because that was true for the KV store I needed this for.

### Not currently implemented

- ~~Parallel requests, or other performance improvements (this currently takes like 1s/request, which, yikes).~~

- A worker-based method that returns multiple keys per request. This would improve efficiency and speed, but would be harder to set up. https://github.com/cloudflare/kv-worker-migrate could be adapted for this. (However, [xkcd 1205](https://xkcd.com/1205/)).

- Downloading the keys from a target namespace and saving only keys that do not exist in said target namespace. This could be useful for incremental restore/migration, particularly when dealing with the daily 1000 write limit for the Workers free tier (when migrating a database with live writes, one could run a fresh query each day and upload ~900 keys to the target).
