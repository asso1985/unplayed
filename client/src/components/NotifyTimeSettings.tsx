interface Props {
  value: number;
  onChange: (hour: number) => void;
}

const OPTIONS = [
  { label: 'Morning', time: '8:00 AM', utcHour: 7 },
  { label: 'Afternoon', time: '2:00 PM', utcHour: 13 },
  { label: 'Evening', time: '7:00 PM', utcHour: 18 },
];

export default function NotifyTimeSettings({ value, onChange }: Props) {
  return (
    <div className="settings-group">
      {OPTIONS.map(o => (
        <label className="srow" key={o.utcHour} style={{ cursor: 'pointer', userSelect: 'none' }}>
          <div className="srow-label">
            <div className="srow-name">{o.label}</div>
            <div className="srow-desc">{o.time} your local time</div>
          </div>
          <input
            type="radio"
            name="notifyHour"
            checked={value === o.utcHour}
            onChange={() => onChange(o.utcHour)}
          />
        </label>
      ))}
    </div>
  );
}
