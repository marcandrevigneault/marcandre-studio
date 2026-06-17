import { useState } from 'react';
import type { Gallery } from './types';
import { emptyGallery } from './types';
import { saveGallery } from './api-client';
import MetaFields from './MetaFields';
import ThemeControls from './ThemeControls';
import LivePreview from './LivePreview';

export default function Builder({ initial }: { initial?: Gallery }) {
  const [gallery, setGallery] = useState<Gallery>(initial ?? emptyGallery());
  const [status, setStatus] = useState<string>('');
  const isEdit = Boolean(initial);

  async function onSave() {
    if (!gallery.title || !gallery.slug || !gallery.cover) {
      setStatus('Title, slug and a cover are required.'); return;
    }
    setStatus('Saving…');
    try {
      await saveGallery(gallery);
      setStatus('Published — live in ~1–2 min (rebuild running).');
    } catch (e) {
      setStatus(`Save failed: ${(e as Error).message}`);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div>
        <MetaFields value={gallery} onChange={setGallery} lockSlug={isEdit} />
        <ThemeControls value={gallery} onChange={setGallery} />
        {/* PhotoUploader + MusicPicker mount here in Task 10 */}
        <div style={{ marginTop: '1rem' }}>
          <button onClick={onSave}>{isEdit ? 'Save changes' : 'Publish'}</button>
          <p>{status}</p>
        </div>
      </div>
      <LivePreview gallery={gallery} />
    </div>
  );
}
