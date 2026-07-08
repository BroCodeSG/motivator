// Web variant of TimeField: the browser's native time input.
function fmt(n: number): string {
  return n.toString().padStart(2, '0');
}

export function TimeField({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  return (
    <input
      type="time"
      value={`${fmt(hour)}:${fmt(minute)}`}
      onChange={(e) => {
        const [h, m] = e.target.value.split(':').map(Number);
        if (!Number.isNaN(h) && !Number.isNaN(m)) onChange(h, m);
      }}
      style={{
        fontSize: 15,
        color: '#e8eaed',
        border: '1px solid #5f6368',
        borderRadius: 8,
        padding: '6px 12px',
        background: 'transparent',
        fontFamily: 'inherit',
        colorScheme: 'dark',
      }}
    />
  );
}
