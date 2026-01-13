import { useState, useEffect } from 'react';

/**
 * useWindowHeight - 윈도우 높이 관리 훅
 * - Android WebView 호환성
 * - Galaxy S25 Ultra 전체화면 표시
 * - CSS 변수 설정 (--app-height)
 */
export default function useWindowHeight(map) {
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const updateHeight = () => {
      // Get the actual viewport height (Android WebView compatible)
      const vh = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0,
        window.screen?.availHeight || 0
      );
      setWindowHeight(vh);

      // Also set CSS custom property for CSS usage
      document.documentElement.style.setProperty('--app-height', `${vh}px`);

      // Force map resize if available
      if (map?.current) {
        setTimeout(() => map.current.resize(), 50);
      }
    };

    updateHeight();

    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    window.addEventListener('load', updateHeight);

    // Delayed updates for Android WebView initialization
    const timeouts = [100, 300, 500, 1000, 2000, 3000].map(delay =>
      setTimeout(updateHeight, delay)
    );

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('load', updateHeight);
      timeouts.forEach(clearTimeout);
    };
  }, [map]);

  return windowHeight;
}
