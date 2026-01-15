/**
 * RainViewer Radar Tile Proxy API
 * CORS 문제 해결을 위한 레이더 타일 프록시
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    // RainViewer tile URL 구성
    const tileUrl = `https://tilecache.rainviewer.com${path}`;

    const response = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'TBAS-Radar-Viewer/1.0',
        'Accept': 'image/png,image/*'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream error: ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type');
    const buffer = await response.arrayBuffer();

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', contentType || 'image/png');

    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error('Radar tile proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch radar tile' });
  }
}
