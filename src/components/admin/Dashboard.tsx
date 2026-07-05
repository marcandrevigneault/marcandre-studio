import { useEffect, useState } from 'react';
import type { Gallery } from './types';
import { fetchGalleries, deleteGallery } from './api-client';

export default function Dashboard() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGalleries()
      .then(setGalleries)
      .catch(() => setError("Couldn't load galleries — check the connection and reload."))
      .finally(() => setLoading(false));
  }, []);

  async function onDelete(slug: string) {
    if (!window.confirm(`Delete gallery "${slug}"? This commits a deletion.`)) return;
    await deleteGallery(slug);
    setGalleries((gs) => gs.filter((g) => g.slug !== slug));
  }

  async function onLogout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.href = '/admin/login';
  }

  return (
    <>
      <div className="topbar">
        <span className="wm">Studio<span className="dot">.</span></span>
        <span className="crumb"><span className="sep">/</span> Galleries</span>
        <span className="grow" />
        <button type="button" className="iconbtn" title="Sign out" onClick={onLogout}>⎋</button>
        <a className="btn" href="/admin/new">+ New gallery</a>
      </div>

      <div className="dash">
        <div className="card">
          <header><h3>Galleries</h3><span className="hint">edit, feature, or remove</span></header>
          <div className="body">
            {loading && <p className="dash-note">Loading…</p>}
            {!loading && error && <p className="dash-note">{error}</p>}
            {!loading && !error && galleries.length === 0 && (
              <p className="dash-note">No galleries yet. Create your first one.</p>
            )}
            {!loading && galleries.map((g) => (
              <div key={g.slug} className="dash-row">
                <a className="dash-thumb" href={`/admin/${g.slug}/edit`} aria-label={`Edit ${g.title || g.slug}`}>
                  {g.cover && <img src={g.cover} alt="" loading="lazy" />}
                </a>
                <div className="dash-meta">
                  <a className="dash-title" href={`/admin/${g.slug}/edit`}>{g.title || g.slug}</a>
                  <span className="dash-chips">
                    <span className="chip mono">/photography/{g.slug}</span>
                    {g.draft && <span className="chip">draft</span>}
                    {g.featured && <span className="chip chip-accent">★ featured</span>}
                  </span>
                </div>
                <a className="btn ghost" href={`/admin/${g.slug}/edit`}>Edit</a>
                <button type="button" className="tinybtn del" title={`Delete ${g.slug}`} onClick={() => onDelete(g.slug)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
