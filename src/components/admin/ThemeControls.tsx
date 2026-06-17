import { HexColorPicker } from 'react-colorful';
import type { Gallery, Theme } from './types';

interface Props { value: Gallery; onChange: (g: Gallery) => void; }

const COLORS: (keyof Theme)[] = ['paper', 'ink', 'muted', 'accent'];

export default function ThemeControls({ value, onChange }: Props) {
  const setTheme = (patch: Partial<Theme>) => onChange({ ...value, theme: { ...value.theme, ...patch } });
  return (
    <fieldset>
      <legend>The world</legend>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {COLORS.map((key) => (
          <div key={key}>
            <span>{key}</span>
            <HexColorPicker color={value.theme[key] as string || '#000000'}
              onChange={(c) => setTheme({ [key]: c } as Partial<Theme>)} />
          </div>
        ))}
      </div>
      <label>Font
        <select value={value.theme.font} onChange={(e) => setTheme({ font: e.target.value as Theme['font'] })}>
          <option>serif</option><option>sans</option><option>mono</option>
        </select>
      </label>
      <label>Motion
        <select value={value.theme.motion} onChange={(e) => setTheme({ motion: e.target.value as Theme['motion'] })}>
          <option>none</option><option>calm</option><option>drift</option><option>reveal</option>
        </select>
      </label>
      <label>Atmosphere
        <select value={value.theme.atmosphere} onChange={(e) => setTheme({ atmosphere: e.target.value as Theme['atmosphere'] })}>
          <option>none</option><option>grain</option><option>vignette</option>
        </select>
      </label>
    </fieldset>
  );
}
