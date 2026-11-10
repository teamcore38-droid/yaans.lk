import { useEffect } from 'react';
import { prefetchPage } from '../utils/navigation.js';

export default function NavigationPrefetch() {
  useEffect(() => {
    const connection = navigator.connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
    let timer;
    const warmLink = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      if (event.type === 'pointerover' && link.contains(event.relatedTarget)) return;
      clearTimeout(timer);
      if (event.type === 'pointerover') timer = setTimeout(() => prefetchPage(link.href), 100);
      else prefetchPage(link.href);
    };
    const cancel = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link?.contains(event.relatedTarget)) clearTimeout(timer);
    };
    document.addEventListener('pointerover', warmLink);
    document.addEventListener('pointerout', cancel);
    document.addEventListener('focusin', warmLink);
    document.addEventListener('touchstart', warmLink, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', warmLink);
      document.removeEventListener('pointerout', cancel);
      document.removeEventListener('focusin', warmLink);
      document.removeEventListener('touchstart', warmLink);
    };
  }, []);
  return null;
}
