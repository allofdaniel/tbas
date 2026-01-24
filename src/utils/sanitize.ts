/**
 * XSS Sanitization Utility
 * 외부 데이터에서 잠재적으로 위험한 문자를 이스케이프
 */

/**
 * HTML 특수 문자 이스케이프
 * 외부 API 응답 등 신뢰할 수 없는 문자열에 사용
 */
export const escapeHtml = (str: string | null | undefined): string => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * 안전한 텍스트 추출 (HTML 태그 제거)
 */
export const stripHtml = (str: string | null | undefined): string => {
  if (str == null) return '';
  return String(str).replace(/<[^>]*>/g, '');
};

/**
 * 허용된 문자만 남기기 (영문, 숫자, 공백, 일부 특수문자)
 * 콜사인, 항공기 등록번호 등에 사용
 */
export const sanitizeCallsign = (str: string | null | undefined): string => {
  if (str == null) return '';
  // 영문, 숫자, 공백, 하이픈, 언더스코어만 허용
  return String(str).replace(/[^A-Za-z0-9\s\-_]/g, '').trim();
};

/**
 * 숫자와 일부 특수문자만 남기기 (고도, 속도 등 표시용)
 */
export const sanitizeNumeric = (str: string | null | undefined): string => {
  if (str == null) return '';
  // 숫자, 점, 쉼표, 공백만 허용
  return String(str).replace(/[^0-9.,\s\-+]/g, '').trim();
};

/**
 * URL 안전성 검사
 * javascript:, data: 등 위험한 프로토콜 차단
 */
export const isSafeUrl = (url: string | null | undefined): boolean => {
  if (url == null) return false;
  const lower = url.toLowerCase().trim();
  // 허용된 프로토콜만 통과
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('/') ||
    lower.startsWith('./') ||
    lower.startsWith('../')
  );
};

/**
 * 안전한 URL 반환 (위험한 경우 빈 문자열)
 */
export const sanitizeUrl = (url: string | null | undefined): string => {
  if (!isSafeUrl(url)) return '';
  return url!;
};
