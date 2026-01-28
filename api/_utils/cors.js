/**
 * CORS 및 Rate Limiting 설정 유틸리티
 * DO-278A 요구사항 추적: SRS-SEC-002, SRS-SEC-003
 *
 * 환경변수 기반 CORS 화이트리스트 및 Rate Limiting 관리
 */

// Rate Limiting 설정
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1분
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '100', 10); // 분당 최대 요청 수

// In-memory rate limit store (per serverless instance)
// Note: Vercel 서버리스 환경에서는 인스턴스별로 분리되므로 완벽하지 않음
// 프로덕션에서는 Vercel KV 또는 Redis 사용 권장
const rateLimitStore = new Map();

/**
 * Rate Limit 정리 (오래된 항목 제거)
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate Limiting 검사
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {boolean} - 요청이 차단되면 true
 */
export function checkRateLimit(req, res) {
  // 정기적 정리 (10% 확률로)
  if (Math.random() < 0.1) {
    cleanupRateLimitStore();
  }

  // 클라이언트 식별자 (IP 또는 X-Forwarded-For)
  const clientId = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.headers['x-real-ip'] ||
                   req.socket?.remoteAddress ||
                   'unknown';

  const now = Date.now();
  let clientData = rateLimitStore.get(clientId);

  if (!clientData || (now - clientData.windowStart > RATE_LIMIT_WINDOW_MS)) {
    // 새 윈도우 시작
    clientData = { windowStart: now, count: 1 };
    rateLimitStore.set(clientId, clientData);
  } else {
    clientData.count++;
  }

  // Rate limit 헤더 설정
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - clientData.count);
  const resetTime = Math.ceil((clientData.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetTime);

  // 제한 초과 시 차단
  if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader('Retry-After', resetTime);
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
      retryAfter: resetTime
    });
    return true;
  }

  return false;
}

/**
 * 허용된 오리진 목록
 * CORS_ALLOWED_ORIGINS 환경변수에서 로드
 */
const getAllowedOrigins = () => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;

  // 기본 허용 목록
  const defaultOrigins = [
    'https://rkpu-viewer.vercel.app',
    'https://tbas.vercel.app',
  ];

  // 개발 환경에서는 localhost 허용
  if (process.env.NODE_ENV !== 'production') {
    defaultOrigins.push(
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173'
    );
  }

  if (envOrigins) {
    return [...new Set([...defaultOrigins, ...envOrigins.split(',')])];
  }

  return defaultOrigins;
};

/**
 * 오리진 검증
 * @param {string} origin - 요청 오리진
 * @returns {boolean} - 허용 여부
 */
export function isOriginAllowed(origin) {
  if (!origin) return false;

  const allowed = getAllowedOrigins();
  // DO-278A SRS-SEC-002: 와일드카드 체크 제거, 정확한 매칭만 허용
  return allowed.some(allowedOrigin => {
    return origin === allowedOrigin;
  });
}

/**
 * CORS 헤더 설정
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {boolean} - preflight 요청인 경우 true
 */
export function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  // 허용된 오리진인 경우에만 해당 오리진 반환
  // DO-278A SRS-SEC-002: 와일드카드 금지, 명시적 화이트리스트만 허용
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // 개발 환경에서도 localhost만 허용 (와일드카드 사용 안함)

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
}

// Legacy function removed for security - DO-278A SRS-SEC-002
// All code should use setCorsHeaders() instead
