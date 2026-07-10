import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { UI } from '@/theme';

// Minimal markdown: **bold** and *italic*, newlines preserved.
interface Span {
  text: string;
  bold: boolean;
  italic: boolean;
}

function tokenize(text: string): Span[] {
  const spans: Span[] = [];
  let bold = false;
  let italic = false;
  let buf = '';
  const flush = () => {
    if (buf) spans.push({ text: buf, bold, italic });
    buf = '';
  };
  for (let i = 0; i < text.length; ) {
    if (text.startsWith('**', i)) {
      flush();
      bold = !bold;
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
  const spans = tokenize(value);
  return (
    <Text style={[styles.body, style]}>
      {spans.map((s, i) => (
        <Text
          key={i}
          style={{
            fontWeight: s.bold ? '700' : '400',
            fontStyle: s.italic ? 'italic' : 'normal',
          }}
        >
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

// Strip markdown markers for previews.
export function stripMarkdown(value: string): string {
  return value.replace(/\*\*/g, '').replace(/\*/g, '');
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

  const change = (next: string) => {
    setDraft(next);
    onChange?.(next);
  };

  const wrap = (marker: string) => {
    const start = Math.min(sel.start, sel.end);
    const end = Math.max(sel.start, sel.end);
    const next = text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end);
    change(next);
    onCommit?.(next);
  };

  const commit = () => {
    if (draft !== null && draft !== value) onCommit?.(draft);
    setDraft(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <Pressable style={styles.tool} onPress={() => wrap('**')}>
          <Text style={styles.toolBold}>B</Text>
        </Pressable>
        <Pressable style={styles.tool} onPress={() => wrap('*')}>
          <Text style={styles.toolItalic}>I</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        value={text}
        placeholder={placeholder}
        placeholderTextColor={UI.textMuted}
        onChangeText={change}
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
  toolbar: { flexDirection: 'row', gap: 8 },
  tool: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 6,
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBold: { color: UI.text, fontWeight: '800', fontSize: 15 },
  toolItalic: { color: UI.text, fontStyle: 'italic', fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: UI.text,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
