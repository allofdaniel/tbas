// Vercel Serverless Function - Proxy for airplanes.live API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { lat, lon, radius } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon parameters are required' });
  }

  const r = radius || 100;
  const apiUrl = `https://api.airplanes.live/v2/point/${lat}/${lon}/${r}`;

  // Retry logic with exponential backoff
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(apiUrl);

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || (attempt + 1) * 2;
        if (attempt < maxRetries - 1) {
          await sleep(retryAfter * 1000);
          continue;
        }
        return res.status(429).json({
          error: 'Rate limited by upstream API',
          retryAfter: retryAfter,
          ac: [] // Return empty array so frontend doesn't crash
        });
      }

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await sleep((attempt + 1) * 1000);
      }
    }
  }

  console.error('Error fetching aircraft data after retries:', lastError);
  return res.status(500).json({
    error: 'Failed to fetch aircraft data',
    details: lastError?.message,
    ac: [] // Return empty array so frontend doesn't crash
  });
}
