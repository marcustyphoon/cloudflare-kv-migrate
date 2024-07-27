import fs from 'fs/promises';

(async () => {
  const data = await fetch('https://example.com/').then((result) => result.text());

  await fs.mkdir('data').catch(() => {});

  await fs.writeFile(`data/example.com.html`, data, {
    encoding: 'utf8',
    flag: 'w+',
  });
})();
