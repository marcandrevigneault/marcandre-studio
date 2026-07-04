import type { BlockLayout } from './types';

type Choice = { key: string; layout: BlockLayout; align?: 'left' | 'right'; label: string; glyph: string };
const CHOICES: Choice[] = [
  { key: 'single', layout: 'single', label: 'Single', glyph: '<rect x="7" y="3" width="10" height="10" rx="1" fill-opacity=".6"/>' },
  { key: 'full', layout: 'full', label: 'Full width', glyph: '<rect x="2" y="3" width="20" height="10" rx="1" fill-opacity=".6"/>' },
  { key: 'two', layout: 'two', label: 'Two across', glyph: '<rect x="2" y="3" width="9" height="10" rx="1" fill-opacity=".6"/><rect x="13" y="3" width="9" height="10" rx="1" fill-opacity=".6"/>' },
  { key: 'twotall', layout: 'twotall', label: 'Two tall', glyph: '<rect x="4" y="1.5" width="6" height="13" rx="1" fill-opacity=".6"/><rect x="14" y="1.5" width="6" height="13" rx="1" fill-opacity=".6"/>' },
  { key: 'mosaic', layout: 'mosaic', label: 'One big + three small', glyph: '<rect x="2" y="3" width="11" height="10" rx="1" fill-opacity=".6"/><rect x="15" y="3" width="7" height="2.6" rx=".7" fill-opacity=".6"/><rect x="15" y="6.7" width="7" height="2.6" rx=".7" fill-opacity=".6"/><rect x="15" y="10.4" width="7" height="2.6" rx=".7" fill-opacity=".6"/>' },
  { key: 'carousel', layout: 'carousel', label: 'Carousel', glyph: '<rect x="4" y="2" width="16" height="8" rx="1" fill-opacity=".6"/><circle cx="9" cy="13" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>' },
  { key: 'text-left', layout: 'image-text', align: 'left', label: 'Image left · text right', glyph: '<rect x="2" y="3" width="9" height="10" rx="1" fill-opacity=".6"/><line x1="14" y1="5" x2="22" y2="5"/><line x1="14" y1="8" x2="22" y2="8"/><line x1="14" y1="11" x2="19" y2="11"/>' },
  { key: 'text-right', layout: 'image-text', align: 'right', label: 'Text left · image right', glyph: '<line x1="2" y1="5" x2="10" y2="5"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="11" x2="7" y2="11"/><rect x="13" y="3" width="9" height="10" rx="1" fill-opacity=".6"/>' },
  { key: 'quad', layout: 'quad', label: 'Four grid', glyph: '<rect x="2" y="2.5" width="9" height="5" rx="1" fill-opacity=".6"/><rect x="13" y="2.5" width="9" height="5" rx="1" fill-opacity=".6"/><rect x="2" y="8.5" width="9" height="5" rx="1" fill-opacity=".6"/><rect x="13" y="8.5" width="9" height="5" rx="1" fill-opacity=".6"/>' },
];

interface Props { value: BlockLayout; align: 'left' | 'right'; onChange: (layout: BlockLayout, align?: 'left' | 'right') => void; }

export default function LayoutPicker({ value, align, onChange }: Props) {
  const isActive = (c: Choice) => c.layout === value && (c.align === undefined || c.align === align);
  return (
    <div className="layoutrail">
      {CHOICES.map((c) => (
        <button key={c.key} type="button" title={c.label} aria-selected={isActive(c)}
          onClick={() => onChange(c.layout, c.align)}
          dangerouslySetInnerHTML={{ __html: `<svg width="24" height="16" viewBox="0 0 24 16">${c.glyph}</svg>` }} />
      ))}
    </div>
  );
}
