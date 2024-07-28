import 'dotenv/config';
import fs from 'fs/promises';
import { uint8ArrayToBase64 } from 'uint8array-extras';

const MAX_UPLOAD_REQUEST_SIZE = 1_000_000 * 100 * 0.8; // 100mb minus a bit
const MAX_UPLOAD_KEYS = 10_000; // set 1000 for workers free tier limit

const TEST_STOP_EARLY = Infinity;

const apiFetch = async (url) => {
  const result = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.GET_ACCOUNT_ID}${url}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GET_BEARER}`,
      },
    },
  ).then((result) => result.json());

  if (!result.success) throw new Error(`fetch error on ${url}`);
  return result;
};

const apiFetchRaw = async (url) => {
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.GET_ACCOUNT_ID}${url}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GET_BEARER}`,
      },
    },
  );
};

(async () => {
  await fs.mkdir('data-get').catch(() => {});
  const timestamp = Math.round(Date.now() / 1000);
  const dir = `data-get/${timestamp}`;
  await fs.mkdir(dir);

  /**
   * fetch keys
   */

  const keys = [];
  let cursor;

  do {
    const queryParams = cursor ? `?cursor=${cursor}` : '';
    const keysResponse = await apiFetch(
      `/storage/kv/namespaces/${process.env.GET_KV_NAMESPACE_ID}/keys${queryParams}`,
    );

    const {
      result,
      result_info: { count, cursor: newCursor },
    } = keysResponse;
    console.log(`fetched ${count} keys`);

    keys.push(...result);
    cursor = newCursor;
  } while (cursor);

  await fs.writeFile(`${dir}/keys.json`, JSON.stringify(keys, null, 2), {
    encoding: 'utf8',
    flag: 'w+',
  });

  /**
   * fetch values and metadata
   */

  const allData = [[]];

  for (const [i, { name: keyName }] of Object.entries(keys.slice(0, TEST_STOP_EARLY))) {
    const [metadataResponse, valueResponse] = await Promise.all([
      apiFetch(`/storage/kv/namespaces/${process.env.GET_KV_NAMESPACE_ID}/metadata/${keyName}`),
      apiFetchRaw(`/storage/kv/namespaces/${process.env.GET_KV_NAMESPACE_ID}/values/${keyName}`),
    ]);
    const metadata = metadataResponse.result;

    // this endpoint has no wrapper? ok sure
    const value = await valueResponse.arrayBuffer();

    const dataValue = {
      key: keyName,
      base64: true,
      value: uint8ArrayToBase64(new Uint8Array(value)),
    };
    if (metadata) {
      dataValue.metadata = metadata;
    }

    const latestData = allData.at(-1);
    const latestDataKeys = latestData.length;
    const latestDataLength = JSON.stringify(latestData, null, 2).length;

    if (latestDataKeys < MAX_UPLOAD_KEYS && latestDataLength < MAX_UPLOAD_REQUEST_SIZE) {
      latestData.push(dataValue);
    } else {
      allData.push([dataValue]);
    }

    if (i % 5 === 0) {
      console.log(`downloaded ${i} values`);
    }
  }

  for (const [i, data] of Object.entries(allData)) {
    await fs.writeFile(`${dir}/data${i}.json`, JSON.stringify(data, null, 2), {
      encoding: 'utf8',
      flag: 'w+',
    });
  }

  console.log('saved all values!');
})();
