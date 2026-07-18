const https = require('https');

exports.handler = async (event) => {
  const sci = ((event.queryStringParameters || {}).sci || '').trim();
  if (!sci) return { statusCode: 400, body: JSON.stringify({ error: 'Missing sci' }) };

  const token = process.env.IUCN_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'IUCN_TOKEN env var not set' }) };

  return new Promise((resolve) => {
    const url = 'https://apiv3.iucnredlist.org/api/v3/species/'
      + encodeURIComponent(sci) + '?token=' + token;

    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body
      }));
    }).on('error', err => resolve({
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }));
  });
};
