/**
 * Fetch Utility Functions
 * HTTP 요청 관련 유틸리티 함수 모음
 */

/**
 * 타임아웃이 적용된 fetch
 * @param url 요청 URL
 * @param options fetch 옵션
 * @param timeout 타임아웃 (밀리초, 기본 5000ms)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * JSON 응답을 반환하는 fetch (타입 검증 포함)
 * @param url 요청 URL
 * @param options fetch 옵션
 * @param timeout 타임아웃 (밀리초)
 */
export async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
  timeout: number = 5000
): Promise<T> {
  const response = await fetchWithTimeout(url, options, timeout);

  // HTTP 에러 확인
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Content-Type 확인
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    // HTML 에러 페이지 감지
    if (text.startsWith('<!') || text.startsWith('<html')) {
      throw new Error('Server returned HTML instead of JSON');
    }
    throw new Error(`Expected JSON, got: ${contentType}`);
  }

  return response.json();
}

/**
 * 재시도 로직이 포함된 fetch
 * @param url 요청 URL
 * @param options fetch 옵션
 * @param retries 최대 재시도 횟수
 * @param delay 재시도 간격 (밀리초)
 * @param timeout 개별 요청 타임아웃
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = 3,
  delay: number = 1000,
  timeout: number = 5000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);

      // 429 Too Many Requests - 지수 백오프로 재시도
      if (response.status === 429 && attempt < retries) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0');
        const waitTime = retryAfter * 1000 || delay * Math.pow(2, attempt);
        console.warn(`Rate limited (429), retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // 5xx 서버 에러 - 재시도
      if (response.status >= 500 && attempt < retries) {
        const waitTime = delay * Math.pow(2, attempt);
        console.warn(`Server error (${response.status}), retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // AbortError (타임아웃) - 재시도
      if ((error as Error).name === 'AbortError' && attempt < retries) {
        const waitTime = delay * Math.pow(2, attempt);
        console.warn(`Request timeout, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // 네트워크 에러 - 재시도
      if (attempt < retries) {
        const waitTime = delay * Math.pow(2, attempt);
        console.warn(`Network error, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}
