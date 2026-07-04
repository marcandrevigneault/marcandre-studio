import { useState } from 'react';
import type { Gallery } from './types';
import { emptyGallery, withClientIds } from './types';
import { saveGallery } from './api-client';
import MetaFields from './MetaFields';
import ThemeControls from './ThemeControls';
import LivePreview from './LivePreview';
import BlocksEditor from './BlocksEditor';
import MusicPicker from './MusicPicker';

type Status = { kind: 'idle' | 'ok' | 'err'; msg: string };

// Convert the client gallery (client-only ids on blocks/images) to the wire
// shape the API expects: no ids, optional text/caption only when present.
function toPayload(g: Gallery): Gallery {
  return {
    ...g,
    blocks: g.blocks.map((b) => ({
      layout: b.layout,
      align: b.align,
      ...(b.text ? { text: b.text } : {}),
      images: b.images.map((im) => ({
        src: im.src,
        alt: im.alt,
        ...(im.caption ? { caption: im.caption } : {}),
      })),
    })),
  } as unknown as Gallery;
}

export default function Builder({ initial }: { initial?: Gallery }) {
  const [gallery, setGallery] = useState<Gallery>(() => (initial ? withClientIds(initial) : emptyGallery()));
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = Boolean(initial);
  const [status, setStatus] = useState<Status>({ kind: 'idle', msg: isEdit ? 'Editing' : 'New draft' });

  const setDraft = (draft: boolean) => setGallery((g) => ({ ...g, draft }));
  const setFeatured = (featured: boolean) => setGallery((g) => ({ ...g, featured }));

  async function onSave() {
    if (isSaving) return;
    if (!gallery.title || !gallery.slug || !gallery.cover) {
      setStatus({ kind: 'err', msg: 'Title, slug and a cover photo are required.' });
      return;
    }
    setIsSaving(true);
    setStatus({ kind: 'idle', msg: 'Publishing…' });
    try {
      await saveGallery(toPayload(gallery));
      setStatus({ kind: 'ok', msg: 'Published — building… live in ~1 min.' });
    } catch (e) {
      setStatus({ kind: 'err', msg: `Publish failed: ${(e as Error).message}` });
    } finally {
      setIsSaving(false);
    }
  }

  async function onLogout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.href = '/admin/login';
  }

  const statusColor = status.kind === 'err' ? '#c0453b' : status.kind === 'ok' ? 'var(--good)' : 'var(--muted)';

  return (
    <>
      <div className="topbar">
        <span className="wm">Studio<span className="dot">.</span></span>
        <span className="crumb">
          <span className="sep">/</span> Galleries <span className="sep">/</span>
          <span className="now">{gallery.title || 'New gallery'}</span>
        </span>
        <span className="grow" />
        <span className="savestate" style={{ color: statusColor }}>
          <span className="savedot" style={{ background: statusColor }} /> {status.msg}
        </span>
        <button type="button" className="iconbtn" title="Sign out" onClick={onLogout}>⎋</button>
        <button type="button" className="btn" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Publishing…' : 'Publish'}
        </button>
      </div>

      <div className="builder">
        <div className="editor">
          <div className="editor-inner">
            <MetaFields value={gallery} onChange={setGallery} lockSlug={isEdit} />
            <ThemeControls value={gallery} onChange={setGallery} />

            <div className="card">
              <header><h3>Photos</h3><span className="hint">pick a layout per block · drag to reorder</span></header>
              <div className="body">
                <BlocksEditor
                  blocks={gallery.blocks}
                  cover={gallery.cover}
                  onChange={(blocks) => setGallery({ ...gallery, blocks })}
                  onCoverChange={(cover) => setGallery({ ...gallery, cover })}
                />
              </div>
            </div>

            <MusicPicker value={gallery} onChange={setGallery} />

            <div className="card">
              <header><h3>Publish</h3></header>
              <div className="body">
                <div className="publishbar">
                  <div className="toggles">
                    <div className="toggle">
                      <span
                        className={`switch${gallery.draft ? ' on' : ''}`} role="switch"
                        aria-checked={gallery.draft} onClick={() => setDraft(!gallery.draft)}
                      />
                      <span><div className="tt">Draft</div><div className="td">hidden from the site</div></span>
                    </div>
                    <div className="toggle">
                      <span
                        className={`switch${gallery.featured ? ' on' : ''}`} role="switch"
                        aria-checked={gallery.featured} onClick={() => setFeatured(!gallery.featured)}
                      />
                      <span><div className="tt">Featured</div><div className="td">top of photography</div></span>
                    </div>
                  </div>
                  <button type="button" className="btn lg" onClick={onSave} disabled={isSaving}>
                    {isSaving ? 'Publishing…' : 'Publish gallery'}
                  </button>
                  <p className="publish-note" style={{ color: statusColor }}>
                    {status.kind === 'idle'
                      ? 'Saves the gallery and rebuilds the site — live in about a minute.'
                      : status.msg}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="preview-pane">
          <div className="preview-head">
            <span className="eyebrow">Live preview</span>
            <span className="livedot" /><span style={{ fontSize: 11.5, color: 'var(--faint)' }}>updating as you type</span>
          </div>
          <div className="frame">
            <div className="frame-bar">
              <span className="d" /><span className="d" /><span className="d" />
              <span className="url">marcandre.studio/photography/{gallery.slug || '…'}</span>
            </div>
            <LivePreview gallery={gallery} />
          </div>
        </div>
      </div>
    </>
  );
}
