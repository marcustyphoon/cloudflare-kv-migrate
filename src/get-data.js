import 'dotenv/config';
import fs from 'fs/promises';

(async () => {
  await fs.mkdir('data-get').catch(() => {});
  const timestamp = Math.round(Date.now() / 1000);
  const dir = `data-get/${timestamp}`;
  await fs.mkdir(dir);

  const keysResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.GET_ACCOUNT_ID}/storage/kv/namespaces/${process.env.GET_KV_NAMESPACE_ID}/keys`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GET_BEARER}`,
      },
    },
  ).then((result) => result.json());

  await fs.writeFile(`${dir}/keys-response.json`, JSON.stringify(keysResponse, null, 2), {
    encoding: 'utf8',
    flag: 'w+',
  });
})();
