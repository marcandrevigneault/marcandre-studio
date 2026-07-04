import { useEffect, useRef, useState } from 'react';
import type { Gallery } from './types';
import { uploadToCloudinary } from './cloudinary-upload';

// Static decorative waveform bars.
const WAVE = [8, 14, 20, 11, 24, 17, 9, 22, 13, 26, 15, 10, 19, 23, 12, 8, 16, 21, 14, 9, 25, 18, 11, 20, 7, 15, 22, 13, 17, 10];

export default function MusicPicker({ value, onChange }: { value: Gallery; onChange: (g: Gallery) => void; }) {
  const [library, setLibrary] = useState<{ src: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
    <div className="card">
      <header><h3>Sound</h3><span className="hint">optional ambient loop</span></header>
      <div className="body">
        <div className="row">
          <div>
            <span className="lbl">From your library</span>
            <select className="input" value={value.audio?.src ?? ''} onChange={(e) => pick(e.target.value)}>
              <option value="">— none —</option>
              {library.map((a) => <option key={a.src} value={a.src}>{a.title}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Uploading…' : 'Upload'}
            </button>
            <input
              ref={fileRef} type="file" accept="audio/*" hidden disabled={busy}
              onChange={(e) => { if (e.target.files) onUpload(e.target.files[0]); e.target.value = ''; }}
            />
          </div>
        </div>

        {error && <p style={{ color: '#c0453b', fontSize: 12, margin: 0 }}>{error}</p>}

        {value.audio && (
          <>
            <div className="track">
              <button type="button" className="play">▶</button>
              <div className="wave">{WAVE.map((h, i) => <i key={i} style={{ height: h }} />)}</div>
              <span className="tname">{value.audio.title || 'Untitled track'}</span>
            </div>
            <div>
              <span className="lbl">Track title</span>
              <input
                className="input" value={value.audio.title}
                onChange={(e) => onChange({ ...value, audio: { ...value.audio!, title: e.target.value } })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
