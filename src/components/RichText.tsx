import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { UI } from '@/theme';

// Minimal markdown: **bold**, *italic*, ==highlight==, ~~strike~~, and lines
// starting with "- " render as bullets. Newlines preserved.
interface Span {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  highlight: boolean;
}

function tokenizeInline(text: string): Span[] {
  const spans: Span[] = [];
  let bold = false;
  let italic = false;
  let strike = false;
  let highlight = false;
  let buf = '';
  const flush = () => {
    if (buf) spans.push({ text: buf, bold, italic, strike, highlight });
    buf = '';
  };
  for (let i = 0; i < text.length; ) {
    if (text.startsWith('**', i)) {
      flush();
      bold = !bold;
      i += 2;
    } else if (text.startsWith('==', i)) {
      flush();
      highlight = !highlight;
      i += 2;
    } else if (text.startsWith('~~', i)) {
      flush();
      strike = !strike;
      i += 2;
    } else if (text[i] === '*') {
      flush();
      italic = !italic;
      i += 1;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  flush();
  return spans;
}

export function RichText({ value, style }: { value: string; style?: TextStyle }) {
  if (!value) return null;
  return (
    <View>
      {value.split('\n').map((line, li) => {
        const bullet = /^- /.test(line);
        const spans = tokenizeInline(bullet ? line.slice(2) : line);
        return (
          <Text key={li} style={[styles.body, style]}>
            {bullet ? '•  ' : ''}
            {spans.map((s, i) => (
              <Text
                key={i}
                style={{
                  fontWeight: s.bold ? '700' : '400',
                  fontStyle: s.italic ? 'italic' : 'normal',
                  textDecorationLine: s.strike ? 'line-through' : 'none',
                  ...(s.highlight ? { backgroundColor: '#fff475', color: '#202124' } : {}),
                }}
              >
                {s.text}
              </Text>
            ))}
            {line === '' ? ' ' : ''}
          </Text>
        );
      })}
    </View>
  );
}

// Strip markers for previews.
export function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/==/g, '')
    .replace(/~~/g, '')
    .replace(/\*/g, '')
    .replace(/^- /gm, '');
}

export function RichTextEditor({
  value,
  onCommit,
  onChange,
  placeholder,
}: {
  value: string;
  onCommit?: (text: string) => void; // fires on blur (use to write to storage)
  onChange?: (text: string) => void; // fires on every keystroke (use for local state)
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const text = draft ?? value;

  const push = (next: string) => {
    setDraft(next);
    onChange?.(next);
    onCommit?.(next);
  };

  const wrap = (marker: string) => {
    const start = Math.min(sel.start, sel.end);
    const end = Math.max(sel.start, sel.end);
    push(text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end));
  };

  const bulletLine = () => {
    const lineStart = text.lastIndexOf('\n', Math.max(0, sel.start - 1)) + 1;
    push(text.slice(0, lineStart) + '- ' + text.slice(lineStart));
  };

  const commit = () => {
    if (draft !== null && draft !== value) onCommit?.(draft);
    setDraft(null);
  };

  const tools: { label: string; style: TextStyle; onPress: () => void }[] = [
    { label: 'B', style: { fontWeight: '800' }, onPress: () => wrap('**') },
    { label: 'I', style: { fontStyle: 'italic' }, onPress: () => wrap('*') },
    { label: 'H', style: { backgroundColor: '#fff475', color: '#202124' }, onPress: () => wrap('==') },
    { label: 'S', style: { textDecorationLine: 'line-through' }, onPress: () => wrap('~~') },
    { label: '• List', style: {}, onPress: bulletLine },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        {tools.map((t) => (
          <Pressable key={t.label} style={styles.tool} onPress={t.onPress}>
            <Text style={[styles.toolText, t.style]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={text}
        placeholder={placeholder}
        placeholderTextColor={UI.textMuted}
        onChangeText={(t) => {
          setDraft(t);
          onChange?.(t);
        }}
        onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
        onEndEditing={commit}
        onBlur={commit}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, color: UI.text, lineHeight: 22 },
  wrap: { gap: 6 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 6,
    minWidth: 34,
    height: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { color: UI.text, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: UI.text,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
