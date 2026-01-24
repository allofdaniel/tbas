/**
 * Sanitize Utility Tests
 * DO-278A 요구사항 추적: SRS-TEST-003
 *
 * 보안 관련 함수 테스트 - XSS 방지
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtml,
  sanitizeCallsign,
  sanitizeNumeric,
  isSafeUrl,
  sanitizeUrl,
} from '../../utils/sanitize';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersand', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("it's a test")).toBe("it&#039;s a test");
  });

  it('should handle null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should not modify safe strings', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('ABC123')).toBe('ABC123');
  });

  it('should handle all special characters together', () => {
    expect(escapeHtml('<div class="test" data-info=\'value\'>A & B</div>')).toBe(
      '&lt;div class=&quot;test&quot; data-info=&#039;value&#039;&gt;A &amp; B&lt;/div&gt;'
    );
  });
});

describe('stripHtml', () => {
  it('should remove HTML tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
    expect(stripHtml('<div><span>Test</span></div>')).toBe('Test');
  });

  it('should remove self-closing tags', () => {
    expect(stripHtml('Line1<br/>Line2')).toBe('Line1Line2');
  });

  it('should remove tags with attributes', () => {
    expect(stripHtml('<a href="http://example.com">Link</a>')).toBe('Link');
  });

  it('should handle null and undefined', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });

  it('should handle malformed HTML', () => {
    expect(stripHtml('<div><span>Unclosed')).toBe('Unclosed');
  });

  it('should preserve text content', () => {
    expect(stripHtml('No HTML here')).toBe('No HTML here');
  });
});

describe('sanitizeCallsign', () => {
  it('should preserve valid callsigns', () => {
    expect(sanitizeCallsign('KAL123')).toBe('KAL123');
    expect(sanitizeCallsign('AAL 1234')).toBe('AAL 1234');
    expect(sanitizeCallsign('N12345')).toBe('N12345');
  });

  it('should remove special characters', () => {
    expect(sanitizeCallsign('KAL<script>123')).toBe('KALscript123');
    expect(sanitizeCallsign('AAL!@#$%^&*()')).toBe('AAL');
  });

  it('should preserve hyphens and underscores', () => {
    expect(sanitizeCallsign('HL-7890')).toBe('HL-7890');
    expect(sanitizeCallsign('TEST_123')).toBe('TEST_123');
  });

  it('should handle null and undefined', () => {
    expect(sanitizeCallsign(null)).toBe('');
    expect(sanitizeCallsign(undefined)).toBe('');
  });

  it('should trim whitespace', () => {
    expect(sanitizeCallsign('  KAL123  ')).toBe('KAL123');
  });
});

describe('sanitizeNumeric', () => {
  it('should preserve numbers', () => {
    expect(sanitizeNumeric('12345')).toBe('12345');
    expect(sanitizeNumeric('123.45')).toBe('123.45');
  });

  it('should preserve commas and spaces', () => {
    expect(sanitizeNumeric('1,234,567')).toBe('1,234,567');
    expect(sanitizeNumeric('123 456')).toBe('123 456');
  });

  it('should preserve negative and positive signs', () => {
    expect(sanitizeNumeric('-500')).toBe('-500');
    expect(sanitizeNumeric('+100')).toBe('+100');
  });

  it('should remove alphabetic characters', () => {
    expect(sanitizeNumeric('12345ft')).toBe('12345');
    expect(sanitizeNumeric('FL350')).toBe('350');
  });

  it('should handle null and undefined', () => {
    expect(sanitizeNumeric(null)).toBe('');
    expect(sanitizeNumeric(undefined)).toBe('');
  });
});

describe('isSafeUrl', () => {
  describe('should accept safe URLs', () => {
    it('accepts https URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe(true);
      expect(isSafeUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('accepts http URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
    });

    it('accepts relative URLs', () => {
      expect(isSafeUrl('/path/to/resource')).toBe(true);
      expect(isSafeUrl('./relative/path')).toBe(true);
      expect(isSafeUrl('../parent/path')).toBe(true);
    });
  });

  describe('should reject unsafe URLs', () => {
    it('rejects javascript: protocol', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
    });

    it('rejects data: protocol', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects vbscript: protocol', () => {
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    });

    it('rejects file: protocol', () => {
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    });
  });

  it('should handle null and undefined', () => {
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });

  it('should handle empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });

  it('should be case-insensitive for protocols', () => {
    expect(isSafeUrl('HTTPS://example.com')).toBe(true);
    expect(isSafeUrl('JavaScript:void(0)')).toBe(false);
  });
});

describe('sanitizeUrl', () => {
  it('should return safe URLs unchanged', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeUrl('/path')).toBe('/path');
  });

  it('should return empty string for unsafe URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('should return empty string for null/undefined', () => {
    expect(sanitizeUrl(null)).toBe('');
    expect(sanitizeUrl(undefined)).toBe('');
  });
});
