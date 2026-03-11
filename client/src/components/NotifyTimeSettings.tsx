interface Props {
  value: number;
  onChange: (hour: number) => void;
}

// Local hours — stored as the desired local hour, converted to UTC in the cron job
const OPTIONS = [
  { label: 'Morning',   time: '8:00 AM',  hour: 8  },
  { label: 'Afternoon', time: '2:00 PM',  hour: 14 },
  { label: 'Evening',   time: '7:00 PM',  hour: 19 },
];

export default function NotifyTimeSettings({ value, onChange }: Props) {
  return (
    <div className="settings-group">
      {OPTIONS.map(o => (
        <label className="srow" key={o.hour} style={{ cursor: 'pointer', userSelect: 'none' }}>
          <div className="srow-label">
            <div className="srow-name">{o.label}</div>
            <div className="srow-desc">{o.time} your local time</div>
          </div>
          <input
            type="radio"
            name="notifyHour"
            checked={value === o.hour}
            onChange={() => onChange(o.hour)}
          />
        </label>
      ))}
    </div>
  );
}
