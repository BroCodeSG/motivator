import { UI } from '@/theme';

const Div: any = 'div';
const doc: any = (globalThis as any).document;
if (doc && !doc.getElementById('rhe-style')) {
  const s = doc.createElement('style');
  s.id = 'rhe-style';
  s.textContent =
    '.rhe[contenteditable]:empty:before{content:attr(data-ph);color:#9aa0a6;}' +
    '.rhe a{color:#8ab4f8;}.rhe mark{background:#fff475;color:#202124;}.rhe h1{font-size:22px;margin:4px 0;}';
  doc.head.appendChild(s);
}

// On web the note is real HTML, so render it directly.
export function RichHtml({ value }: { value: string; style?: any }) {
  if (!value) return null;
  return (
    <Div
      className="rhe"
      style={{ color: UI.text, fontSize: 15, lineHeight: 1.5 }}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}
