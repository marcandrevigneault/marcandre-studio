import { useEffect, useState } from 'react';
import type { Gallery } from './types';
import { fetchGalleries, deleteGallery } from './api-client';

export default function Dashboard() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchGalleries().then(setGalleries).finally(() => setLoading(false)); }, []);

  async function onDelete(slug: string) {
    if (!window.confirm(`Delete gallery "${slug}"? This commits a deletion.`)) return;
    await deleteGallery(slug);
    setGalleries((gs) => gs.filter((g) => g.slug !== slug));
  }

  return (
    <div className="editor">
      <div className="editor-inner">
        <div className="topbar" style={{ border: 0, background: 'transparent', padding: '0 0 8px' }}>
          <span className="wm">Studio<span className="dot">.</span></span>
          <span className="crumb"><span className="sep">/</span> Galleries</span>
          <span className="grow" />
          <a className="btn" href="/admin/new">+ New gallery</a>
        </div>

        <div className="card">
          <header><h3>Galleries</h3><span className="hint">edit, feature, or remove</span></header>
          <div className="body">
            {loading && <p style={{ color: 'var(--muted)', margin: 0 }}>Loading…</p>}
            {!loading && galleries.length === 0 && (
              <p style={{ color: 'var(--muted)', margin: 0 }}>No galleries yet. Create your first one.</p>
            )}
            {!loading && galleries.map((g) => (
              <div key={g.slug} className="photo" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <div className="pmeta">
                  <span style={{ fontSize: 15 }}>{g.title || g.slug}</span>
                  <span className="slug" style={{ margin: 0 }}>
                    <span className="chip mono">/photography/{g.slug}</span>
                    {g.draft && <span className="chip">draft</span>}
                    {g.featured && <span className="chip">★ featured</span>}
                  </span>
                </div>
                <a className="btn ghost" href={`/admin/${g.slug}/edit`}>Edit</a>
                <button type="button" className="tinybtn del" title="Delete" onClick={() => onDelete(g.slug)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
