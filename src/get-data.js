import 'dotenv/config';
import fs from 'fs/promises';
import { uint8ArrayToBase64 } from 'uint8array-extras';

const MAX_UPLOAD_REQUEST_SIZE = 1_000_000 * 100 * 0.8; // 100mb minus a bit
const MAX_UPLOAD_KEYS = 10_000; // set 1000 for workers free tier limit

const TEST_STOP_EARLY = Infinity; // saves only this many keys
const TEST_RESUME_AFTER = ''; // skips keys up to and including this

const apiFetchInternal = async (url) => {
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

const apiFetch = async (url) => {
  try {
    return await apiFetchInternal(url);
  } catch (e) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await apiFetchInternal(url);
  }
};

const apiFetchRawInternal = async (url) => {
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.GET_ACCOUNT_ID}${url}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GET_BEARER}`,
      },
    },
  );
};

const apiFetchRaw = async (url) => {
  try {
    return await apiFetchRawInternal(url);
  } catch (e) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await apiFetchRawInternal(url);
  }
};

(async () => {
  await fs.mkdir('data-get').catch(() => {});
  const timestamp = Math.round(Date.now() / 1000);
  const dir = `data-get/${timestamp}`;
  await fs.mkdir(dir);

  /**
   * fetch keys
   */

  let keys = [];
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

  if (TEST_RESUME_AFTER) {
    const index = keys.findIndex(({ name }) => name === TEST_RESUME_AFTER);
    if (index === -1) throw new Error(`could not find key ${TEST_RESUME_AFTER} to resume after`);

    keys = keys.slice(index + 1);
  }

  /**
   * fetch values and metadata
   */

  const allData = [[]];

  const failures = [];

  const keysToFetch = keys.slice(0, TEST_STOP_EARLY);
  let i = 0;

  for (const entry of keysToFetch) {
    i++;

    const { name: keyName } = entry;

    try {
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
    } catch (e) {
      console.log(`failure on key ${keyName}`);
      failures.push(entry);
    }

    if (i % 5 === 0) {
      console.log(`downloaded ${i} values`);

      for (const [i, data] of Object.entries(allData)) {
        await fs.writeFile(`${dir}/data${i}.json`, JSON.stringify(data, null, 2), {
          encoding: 'utf8',
          flag: 'w+',
        });
      }
    }

    if (failures.length) {
      await fs.writeFile(`${dir}/failures.json`, JSON.stringify(failures, null, 2), {
        encoding: 'utf8',
        flag: 'w+',
      });
    }
  }

  for (const [i, data] of Object.entries(allData)) {
    await fs.writeFile(`${dir}/data${i}.json`, JSON.stringify(data, null, 2), {
      encoding: 'utf8',
      flag: 'w+',
    });
  }

  if (failures.length) {
    await fs.writeFile(`${dir}/failures.json`, JSON.stringify(failures, null, 2), {
      encoding: 'utf8',
      flag: 'w+',
    });
  }

  console.log('saved all values!');
})();
