import 'dotenv/config';
import fs from 'fs/promises';

(async () => {
  await fs.mkdir('data-get').catch(() => {});
  const timestamp = Math.round(Date.now() / 1000);
  const dir = `data-get/${timestamp}`;
  await fs.mkdir(dir);

  const keys = [];
  let cursor;

  do {
    const queryParams = cursor ? `?cursor=${cursor}` : '';
    const keysResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.GET_ACCOUNT_ID}/storage/kv/namespaces/${process.env.GET_KV_NAMESPACE_ID}/keys${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GET_BEARER}`,
        },
      },
    ).then((result) => result.json());

    const {
      success,
      result,
      errors,
      result_info: { count, cursor: newCursor },
    } = keysResponse;
    if (!success) throw new Error(errors);
    console.log(`fetched ${count} keys`);

    keys.push(...result);
    cursor = newCursor;
  } while (cursor);

  await fs.writeFile(`${dir}/keys.json`, JSON.stringify(keys, null, 2), {
    encoding: 'utf8',
    flag: 'w+',
  });
})();
