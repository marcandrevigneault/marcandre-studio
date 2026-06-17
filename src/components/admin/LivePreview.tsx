import { useEffect, useRef, useState } from 'react';
import type { Gallery } from './types';
import { renderPreview } from './api-client';

export default function LivePreview({ gallery }: { gallery: Gallery }) {
  const [html, setHtml] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      renderPreview(gallery).then(setHtml).catch(() => {});
    }, 400);
    return () => clearTimeout(timer.current);
  }, [gallery]);

  return (
    <aside style={{ position: 'sticky', top: '1rem', height: '85vh' }}>
      <iframe
        title="Live preview"
        srcDoc={html}
        sandbox="allow-same-origin"
        style={{ width: '100%', height: '100%', border: '1px solid #ddd', borderRadius: 8 }}
      />
    </aside>
  );
}
