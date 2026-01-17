/**
 * useWindowHeight Hook
 * 윈도우 높이 관리 (모바일 브라우저 대응)
 */
import { useState, useEffect } from 'react';

export const useWindowHeight = (): number => {
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    // 모바일 브라우저의 주소창 숨김 등에 대응
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return windowHeight;
};

export default useWindowHeight;
