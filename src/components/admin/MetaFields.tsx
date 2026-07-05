import type { Gallery } from './types';
import { slugify } from './slugify';

interface Props { value: Gallery; onChange: (g: Gallery) => void; lockSlug: boolean; }

export default function MetaFields({ value, onChange, lockSlug }: Props) {
  const set = (patch: Partial<Gallery>) => onChange({ ...value, ...patch });
  return (
    <div className="card">
      <header><h3>Details</h3><span className="hint">what &amp; where</span></header>
      <div className="body">
        <div>
          <input
            className="title-input" placeholder="Gallery title" value={value.title}
            onChange={(e) => set({ title: e.target.value, ...(lockSlug ? {} : { slug: slugify(e.target.value) }) })}
          />
          <div className="slug">
            url <span className="chip mono">/photography/{value.slug || '…'}</span>
            {!lockSlug && ' · auto from title'}
          </div>
        </div>
        <div className="row">
          <div>
            <span className="lbl">Place</span>
            <input className="input" placeholder="Where" value={value.place ?? ''} onChange={(e) => set({ place: e.target.value })} />
          </div>
          <div>
            <span className="lbl">Date</span>
            <input className="input" type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
        </div>
        <div>
          <span className="lbl">Summary</span>
          <textarea className="input" value={value.summary} onChange={(e) => set({ summary: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
