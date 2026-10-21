const key = process.env.INDEXNOW_KEY;
if (!key) {
  console.error('INDEXNOW_KEY not set. Run: node --env-file=.env.local scripts/indexnow.mjs');
  process.exit(1);
}
const host = 'welpup.fun';
const urlList = [
  `https://${host}/`,
  `https://${host}/signals`,
  `https://${host}/dashboard`,
  `https://${host}/swap`,
  `https://${host}/autonomous`,
];
const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
});
console.log(`IndexNow: ${response.status} ${await response.text()}`);
