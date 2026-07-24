import { useEffect, useRef } from 'react';

import { UI } from '@/theme';

const Div: any = 'div';
const Btn: any = 'button';
const doc: any = (globalThis as any).document;

// Inject a placeholder rule for the empty editor once.
if (doc && !doc.getElementById('rhe-style')) {
  const s = doc.createElement('style');
  s.id = 'rhe-style';
  s.textContent =
    '.rhe[contenteditable]:empty:before{content:attr(data-ph);color:#9aa0a6;}' +
    '.rhe a{color:#8ab4f8;}.rhe mark{background:#fff475;color:#202124;}.rhe h1{font-size:22px;margin:4px 0;}';
  doc.head.appendChild(s);
}

// True WYSIWYG editor for the web: a contentEditable region + a toolbar that
// applies formatting to the current selection in place. Emits HTML.
export function RichHtmlEditor({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
  onChange?: (html: string) => void; // every input (use for local state)
  onCommit?: (html: string) => void; // on blur (use to write to storage)
  placeholder?: string;
}) {
  const ref = useRef<any>(null);
  const last = useRef(value);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || '';
      last.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ref.current && value !== last.current && doc?.activeElement !== ref.current) {
      ref.current.innerHTML = value || '';
      last.current = value;
    }
  }, [value]);

  const emit = () => {
    const html = ref.current?.innerHTML || '';
    last.current = html;
    onChange?.(html);
  };
  const commit = () => {
    const html = ref.current?.innerHTML || '';
    last.current = html;
    onCommit?.(html);
    onChange?.(html);
  };
  const cmd = (c: string, a?: string) => {
    doc.execCommand(c, false, a);
    ref.current?.focus();
    emit();
  };
  const highlight = () => {
    if (!doc.execCommand('hiliteColor', false, '#fff475')) doc.execCommand('backColor', false, '#fff475');
    ref.current?.focus();
    emit();
  };
  const link = () => {
    const url = (globalThis as any).prompt?.('Link URL', 'https://');
    if (url) doc.execCommand('createLink', false, url);
    ref.current?.focus();
    emit();
  };

  const tools: { l: string; s?: any; f: () => void }[] = [
    { l: 'H1', f: () => cmd('formatBlock', 'H1') },
    { l: 'B', s: { fontWeight: 'bold' }, f: () => cmd('bold') },
    { l: 'I', s: { fontStyle: 'italic' }, f: () => cmd('italic') },
    { l: 'U', s: { textDecoration: 'underline' }, f: () => cmd('underline') },
    { l: 'H', s: { background: '#fff475', color: '#202124' }, f: highlight },
    { l: 'S', s: { textDecoration: 'line-through' }, f: () => cmd('strikeThrough') },
    { l: '• List', f: () => cmd('insertUnorderedList') },
    { l: '🔗', f: link },
  ];

  const btn = {
    border: `1px solid ${UI.border}`,
    borderRadius: 6,
    minWidth: 34,
    height: 30,
    padding: '0 8px',
    background: 'transparent',
    color: UI.text,
    fontSize: 14,
    cursor: 'pointer',
  };

  return (
    <Div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tools.map((t) => (
          <Btn key={t.l} type="button" onMouseDown={(e: any) => e.preventDefault()} onClick={t.f} style={{ ...btn, ...(t.s || {}) }}>
            {t.l}
          </Btn>
        ))}
      </Div>
      <Div
        ref={ref}
        className="rhe"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={commit}
        data-ph={placeholder || ''}
        style={{
          minHeight: 56,
          border: `1px solid ${UI.border}`,
          borderRadius: 8,
          padding: 12,
          color: UI.text,
          fontSize: 15,
          lineHeight: 1.5,
          background: 'rgba(0,0,0,0.15)',
          outline: 'none',
          overflowY: 'auto',
        }}
      />
    </Div>
  );
}
