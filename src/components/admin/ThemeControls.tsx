import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import type { Gallery, Theme, Font, Motion, Atmosphere } from './types';

interface Props { value: Gallery; onChange: (g: Gallery) => void; }

const SWATCHES: { key: keyof Theme; label: string; fallback: string }[] = [
  { key: 'paper', label: 'Paper', fallback: '#fbfaf7' },
  { key: 'ink', label: 'Ink', fallback: '#1a1916' },
  { key: 'muted', label: 'Muted', fallback: '#6f6b63' },
  { key: 'accent', label: 'Accent', fallback: '#9a6b4f' },
];

const FONTS: Font[] = ['serif', 'sans', 'mono'];
const MOTIONS: Motion[] = ['none', 'calm', 'drift', 'reveal'];
const ATMOS: Atmosphere[] = ['none', 'grain', 'vignette'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Segbar<T extends string>({ options, value, onSelect }: { options: T[]; value: T; onSelect: (v: T) => void }) {
  return (
    <div className="segbar">
      {options.map((o) => (
        <button key={o} type="button" aria-selected={o === value} onClick={() => onSelect(o)}>{cap(o)}</button>
      ))}
    </div>
  );
}

export default function ThemeControls({ value, onChange }: Props) {
  const [open, setOpen] = useState<keyof Theme | null>(null);
  const setTheme = (patch: Partial<Theme>) => onChange({ ...value, theme: { ...value.theme, ...patch } });

  return (
    <div className="card">
      <header><h3>The look</h3><span className="hint">this gallery's world</span></header>
      <div className="body">
        <div className="swatches">
          {SWATCHES.map(({ key, label, fallback }) => {
            const hex = (value.theme[key] as string) || fallback;
            return (
              <div key={key} style={{ position: 'relative' }}>
                <button type="button" className="swatch" style={{ width: '100%' }} onClick={() => setOpen(open === key ? null : key)}>
                  <span className="chipc" style={{ background: hex, display: 'block' }} />
                  <span className="meta">
                    <div className="nm">{label}</div>
                    <div className="hx">{hex}</div>
                  </span>
                </button>
                {open === key && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setOpen(null)} />
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 21 }}>
                      <HexColorPicker color={hex} onChange={(c) => setTheme({ [key]: c } as Partial<Theme>)} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="control-row">
          <span className="lbl" style={{ margin: 0 }}>Type</span>
          <Segbar options={FONTS} value={value.theme.font} onSelect={(font) => setTheme({ font })} />
        </div>
        <div className="control-row">
          <span className="lbl" style={{ margin: 0 }}>Motion</span>
          <Segbar options={MOTIONS} value={value.theme.motion} onSelect={(motion) => setTheme({ motion })} />
        </div>
        <div className="control-row">
          <span className="lbl" style={{ margin: 0 }}>Atmosphere</span>
          <Segbar options={ATMOS} value={value.theme.atmosphere} onSelect={(atmosphere) => setTheme({ atmosphere })} />
        </div>
      </div>
    </div>
  );
}
