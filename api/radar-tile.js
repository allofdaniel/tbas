/**
 * RainViewer Radar Tile Proxy API
 * DO-278A 요구사항 추적: SRS-API-004
 * CORS 문제 해결을 위한 레이더 타일 프록시
 */
import { setCorsHeaders } from './_utils/cors.js';

/**
 * 경로 유효성 검증 - Path Traversal 방지
 * @param {string} path - 타일 경로
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePath(path) {
  // Path traversal 공격 방지
  if (path.includes('..') || path.includes('//')) {
    return { valid: false, error: 'Invalid path: path traversal not allowed' };
  }
  // 허용된 경로 패턴만 허용 (타일 경로)
  const validPattern = /^\/v2\/radar\/[a-z0-9_]+\/\d+\/\d+\/\d+\/\d+\.png$/i;
  if (!validPattern.test(path)) {
    return { valid: false, error: 'Invalid path format' };
  }
  return { valid: true };
}

export default async function handler(req, res) {
  // CORS 처리 (강화된 버전)
  if (setCorsHeaders(req, res)) return;

  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  // DO-278A SRS-SEC-004: 입력 검증
  const validation = validatePath(path);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
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
