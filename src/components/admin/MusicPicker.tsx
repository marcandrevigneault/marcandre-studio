import { useEffect, useState } from 'react';
import type { Gallery } from './types';
import { uploadToCloudinary } from './cloudinary-upload';

export default function MusicPicker({ value, onChange }: { value: Gallery; onChange: (g: Gallery) => void; }) {
  const [library, setLibrary] = useState<{ src: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetch('/api/audio').then((r) => r.json()).then(setLibrary).catch(() => {}); }, []);

  function pick(src: string) {
    if (!src) return onChange({ ...value, audio: undefined });
    const found = library.find((a) => a.src === src);
    const title = value.audio?.src === src ? value.audio.title : (found?.title ?? '');
    onChange({ ...value, audio: { src, title, loop: true } });
  }

  async function onUpload(file: File) {
    setBusy(true);
    setError('');
    try {
      const { url } = await uploadToCloudinary(file, 'mas/audio', 'video'); // audio uses 'video' resource type
      const entry = { src: url, title: file.name.replace(/\.[^.]+$/, '') };
      setLibrary((l) => [...l, entry]);
      onChange({ ...value, audio: { src: url, title: entry.title, loop: true } });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <fieldset>
      <legend>Ambient music</legend>
      <select value={value.audio?.src ?? ''} onChange={(e) => pick(e.target.value)}>
        <option value="">— none —</option>
        {library.map((a) => <option key={a.src} value={a.src}>{a.title}</option>)}
      </select>
      <input type="file" accept="audio/*" disabled={busy}
        onChange={(e) => e.target.files && onUpload(e.target.files[0])} />
      {error && <p style={{ color: '#c00' }}>{error}</p>}
      {value.audio && (
        <label>Track title
          <input value={value.audio.title}
            onChange={(e) => onChange({ ...value, audio: { ...value.audio!, title: e.target.value } })} />
        </label>
      )}
    </fieldset>
  );
}
