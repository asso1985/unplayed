import type { ReleaseType } from '@/types';

interface Props {
  value: ReleaseType[];
  onChange: (types: ReleaseType[]) => void;
}

const TYPES: { type: ReleaseType; desc: string }[] = [
  { type: 'Album', desc: 'Full-length albums' },
  { type: 'EP', desc: 'Extended plays' },
  { type: 'Single', desc: 'Single tracks' },
];

export default function TypeSettings({ value, onChange }: Props) {
  function toggle(t: ReleaseType) {
    if (value.includes(t)) {
      onChange(value.filter(v => v !== t));
    } else {
      onChange([...value, t]);
    }
  }

  return (
    <div className="settings-group">
      {TYPES.map(({ type, desc }) => (
        <label className="srow" key={type} style={{ cursor: 'pointer', userSelect: 'none' }}>
          <div className="srow-label">
            <div className="srow-name">{type}</div>
            <div className="srow-desc">{desc}</div>
          </div>
          <input
            type="checkbox"
            checked={value.includes(type)}
            onChange={() => toggle(type)}
          />
        </label>
      ))}
    </div>
  );
}
