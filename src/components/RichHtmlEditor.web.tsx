import { useEffect, useRef, useState } from 'react';

import { UI } from '@/theme';

const Div: any = 'div';
const Btn: any = 'button';
const doc: any = (globalThis as any).document;

if (doc && !doc.getElementById('rhe-style')) {
  const s = doc.createElement('style');
  s.id = 'rhe-style';
  s.textContent =
    '.rhe[contenteditable]:empty:before{content:attr(data-ph);color:#9aa0a6;}' +
    '.rhe a{color:#8ab4f8;}.rhe mark{background:#fff475;color:#202124;}' +
    '.rhe h1{font-size:24px;margin:6px 0;}.rhe h2{font-size:20px;margin:5px 0;}.rhe h3{font-size:17px;margin:4px 0;}';
  doc.head.appendChild(s);
}

const HIGHLIGHTS = [
  { name: 'Yellow', c: '#fff475' },
  { name: 'Green', c: '#ccff90' },
  { name: 'Blue', c: '#aecbfa' },
  { name: 'Pink', c: '#fdcfe8' },
  { name: 'Orange', c: '#fbbc04' },
];

// True WYSIWYG editor for the web: contentEditable + a toolbar that formats the
// current selection in place. Toolbar buttons light up for the active styles.
export function RichHtmlEditor({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
  onChange?: (html: string) => void;
  onCommit?: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<any>(null);
  const last = useRef(value);
  const [act, setAct] = useState<any>({});

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

  const updateActive = () => {
    try {
      setAct({
        bold: doc.queryCommandState('bold'),
        italic: doc.queryCommandState('italic'),
        underline: doc.queryCommandState('underline'),
        strike: doc.queryCommandState('strikeThrough'),
        ul: doc.queryCommandState('insertUnorderedList'),
        block: String(doc.queryCommandValue('formatBlock') || '').toLowerCase(),
      });
    } catch {
      /* ignore */
    }
  };

  const emit = () => {
    const html = ref.current?.innerHTML || '';
    last.current = html;
    onChange?.(html);
  };
  const after = () => {
    ref.current?.focus();
    emit();
    updateActive();
  };
  const cmd = (c: string, a?: string) => {
    doc.execCommand(c, false, a);
    after();
  };
  const heading = (tag: string) => cmd('formatBlock', tag);
  const highlight = (color: string) => {
    if (!doc.execCommand('hiliteColor', false, color)) doc.execCommand('backColor', false, color);
    after();
  };
  const link = () => {
    const url = (globalThis as any).prompt?.('Link URL', 'https://');
    if (url) doc.execCommand('createLink', false, url);
    after();
  };

  const btn = (active?: boolean, extra?: any) => ({
    border: `1px solid ${active ? UI.accent : UI.border}`,
    background: active ? 'rgba(138,180,248,0.22)' : 'transparent',
    color: UI.text,
    borderRadius: 6,
    minWidth: 32,
    height: 30,
    padding: '0 8px',
    fontSize: 14,
    cursor: 'pointer',
    ...(extra || {}),
  });

  const md = (e: any) => e.preventDefault(); // keep selection when clicking a button

  return (
    <Div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Btn type="button" onMouseDown={md} onClick={() => heading('P')} style={btn(act.block === 'p' || act.block === 'div')}>¶</Btn>
        <Btn type="button" onMouseDown={md} onClick={() => heading('H1')} style={btn(act.block === 'h1')}>H1</Btn>
        <Btn type="button" onMouseDown={md} onClick={() => heading('H2')} style={btn(act.block === 'h2')}>H2</Btn>
        <Btn type="button" onMouseDown={md} onClick={() => heading('H3')} style={btn(act.block === 'h3')}>H3</Btn>
        <Btn type="button" onMouseDown={md} onClick={() => cmd('bold')} style={btn(act.bold, { fontWeight: 'bold' })}>B</Btn>
        <Btn type="button" onMouseDown={md} onClick={() => cmd('italic')} style={btn(act.italic, { fontStyle: 'italic' })}>I</Btn>
        <Btn type="button" onMouseDown={md} onClick={() => cmd('underline')} style={btn(act.underline, { textDecoration: 'underline' })}>U</Btn>
        <Btn type="button" onMouseDown={md} onClick={() => cmd('strikeThrough')} style={btn(act.strike, { textDecoration: 'line-through' })}>S</Btn>
        <Btn type="button" onMouseDown={md} onClick={() => cmd('insertUnorderedList')} style={btn(act.ul)}>• List</Btn>
        <Btn type="button" onMouseDown={md} onClick={link} style={btn(false)}>🔗</Btn>
        <Div style={{ width: 1, height: 22, background: UI.border, margin: '0 2px' }} />
        {HIGHLIGHTS.map((h) => (
          <Btn
            key={h.c}
            type="button"
            title={`Highlight ${h.name}`}
            onMouseDown={md}
            onClick={() => highlight(h.c)}
            style={{ border: `1px solid ${UI.border}`, background: h.c, width: 22, height: 22, borderRadius: 4, cursor: 'pointer' }}
          />
        ))}
        <Btn type="button" title="Remove highlight" onMouseDown={md} onClick={() => highlight('transparent')} style={btn(false, { fontSize: 12 })}>
          ⌫ HL
        </Btn>
      </Div>
      <Div
        ref={ref}
        className="rhe"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={() => onCommit?.(ref.current?.innerHTML || '')}
        onKeyUp={updateActive}
        onMouseUp={updateActive}
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
