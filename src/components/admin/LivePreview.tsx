import { useEffect, useRef, useState } from 'react';
import type { Gallery } from './types';
import { renderPreview } from './api-client';

export default function LivePreview({ gallery }: { gallery: Gallery }) {
  const [html, setHtml] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      renderPreview(gallery)
        .then((h) => {
          setHtml(h);
          setPreviewError(false);
        })
        .catch(() => setPreviewError(true));
    }, 400);
    return () => clearTimeout(timer.current);
  }, [gallery]);

  return (
    <aside style={{ position: 'sticky', top: '1rem', height: '85vh' }}>
      {previewError && (
        <p className="hint" style={{ margin: '0 0 6px' }}>
          Preview unavailable — retrying as you type.
        </p>
      )}
      <iframe
        title="Live preview"
        srcDoc={html}
        sandbox="allow-scripts"
        style={{ width: '100%', height: '100%', border: '1px solid #ddd', borderRadius: 8 }}
      />
    </aside>
  );
}
