import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);

  return null;
}
