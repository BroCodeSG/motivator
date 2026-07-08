// Web variant of OnceField: the browser's native datetime picker.
export function defaultOnceDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OnceField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (localIso: string) => void;
}) {
  return (
    <input
      type="datetime-local"
      value={value ?? toLocalIso(defaultOnceDate())}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
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
        marginTop: 6,
      }}
    />
  );
}
