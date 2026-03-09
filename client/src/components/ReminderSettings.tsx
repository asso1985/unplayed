interface Props {
  days: number[];
  onChange: (days: number[]) => void;
}

export default function ReminderSettings({ days, onChange }: Props) {
  function update(i: number, val: number) {
    const next = [...days];
    next[i] = val;
    onChange(next);
  }

  function remove(i: number) {
    if (days.length <= 1) return;
    onChange(days.filter((_, idx) => idx !== i));
  }

  function add() {
    onChange([...days, 14]);
  }

  return (
    <div className="settings-group">
      {days.map((d, i) => (
        <div className="srow" key={i}>
          <div className="srow-label">
            <div className="srow-name">Reminder {i + 1}</div>
            <div className="srow-desc">days after saving to library</div>
          </div>
          <input
            type="number"
            min={1}
            max={365}
            value={d}
            onChange={e => update(i, parseInt(e.target.value) || 1)}
          />
          <button className="btn-del" onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className="btn-add" onClick={add}>＋ Add reminder</button>
    </div>
  );
}
