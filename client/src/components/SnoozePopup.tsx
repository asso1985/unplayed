interface Props {
  open: boolean;
  onSnooze: (days: number) => void;
}

const OPTIONS = [
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
];

export default function SnoozePopup({ open, onSnooze }: Props) {
  return (
    <div className={`snooze-pop${open ? ' open' : ''}`}>
      {OPTIONS.map(o => (
        <button key={o.days} className="snooze-opt" onClick={() => onSnooze(o.days)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
