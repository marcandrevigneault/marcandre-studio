import { useEffect, useState } from 'react';
import type { Gallery } from './types';
import { fetchGalleries, deleteGallery } from './api-client';

export default function Dashboard() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchGalleries().then(setGalleries).finally(() => setLoading(false)); }, []);

  async function onDelete(slug: string) {
    if (!confirm(`Delete gallery "${slug}"? This commits a deletion.`)) return;
    await deleteGallery(slug);
    setGalleries((gs) => gs.filter((g) => g.slug !== slug));
  }

  if (loading) return <p>Loading…</p>;
  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Galleries</h1>
        <a href="/admin/new" role="button" style={{ padding: '0.5rem 1rem', border: '1px solid #999', borderRadius: '4px', textDecoration: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-block' }}>+ New gallery</a>
      </header>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {galleries.map((g) => (
          <li key={g.slug} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '.5rem 0', borderBottom: '1px solid #eee' }}>
            <span style={{ flex: 1 }}>{g.title || g.slug}</span>
            {g.draft && <em>draft</em>}
            {g.featured && <strong>★</strong>}
            <a href={`/admin/${g.slug}/edit`}>Edit</a>
            <button onClick={() => onDelete(g.slug)}>Delete</button>
          </li>
        ))}
        {galleries.length === 0 && <li>No galleries yet. Create your first one.</li>}
      </ul>
    </div>
  );
}
