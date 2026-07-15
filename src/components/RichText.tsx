import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { UI } from '@/theme';

// Minimal markdown: **bold**, *italic*, ==highlight==, ~~strike~~, [text](url)
// links, lines starting with "# " / "## " are headings, "- " are bullets.
interface Span {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  highlight: boolean;
  url?: string;
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
    if (text[i] === '[') {
      const m = /^\[([^\]]+)\]\(([^)]+)\)/.exec(text.slice(i));
      if (m) {
        flush();
        spans.push({ text: m[1], bold, italic, strike, highlight, url: m[2] });
        i += m[0].length;
        continue;
      }
    }
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
        let heading = 0;
        let bullet = false;
        let content = line;
        if (/^## /.test(line)) {
          heading = 2;
          content = line.slice(3);
        } else if (/^# /.test(line)) {
          heading = 1;
          content = line.slice(2);
        } else if (/^- /.test(line)) {
          bullet = true;
          content = line.slice(2);
        }
        const lineStyle = heading === 1 ? styles.h1 : heading === 2 ? styles.h2 : styles.body;
        return (
          <Text key={li} style={[lineStyle, style]}>
            {bullet ? '•  ' : ''}
            {tokenizeInline(content).map((s, i) => (
              <Text
                key={i}
                onPress={s.url ? () => Linking.openURL(s.url!).catch(() => {}) : undefined}
                style={{
                  fontWeight: s.bold || heading ? '700' : '400',
                  fontStyle: s.italic ? 'italic' : 'normal',
                  textDecorationLine: s.strike ? 'line-through' : s.url ? 'underline' : 'none',
                  ...(s.url ? { color: UI.accent } : {}),
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

export function stripMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/==/g, '')
    .replace(/~~/g, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6} /gm, '')
    .replace(/^- /gm, '• ');
}

export function RichTextEditor({
  value,
  onCommit,
  onChange,
  placeholder,
}: {
  value: string;
  onCommit?: (text: string) => void;
  onChange?: (text: string) => void;
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
    const s = Math.min(sel.start, sel.end);
    const e = Math.max(sel.start, sel.end);
    push(text.slice(0, s) + marker + text.slice(s, e) + marker + text.slice(e));
  };

  const linePrefix = (prefix: string) => {
    const ls = text.lastIndexOf('\n', Math.max(0, sel.start - 1)) + 1;
    push(text.slice(0, ls) + prefix + text.slice(ls));
  };

  const link = () => {
    const s = Math.min(sel.start, sel.end);
    const e = Math.max(sel.start, sel.end);
    const label = text.slice(s, e) || 'link';
    push(text.slice(0, s) + `[${label}](https://)` + text.slice(e));
  };

  const commit = () => {
    if (draft !== null && draft !== value) onCommit?.(draft);
    setDraft(null);
  };

  const tools: { label: string; style?: TextStyle; onPress: () => void }[] = [
    { label: 'H1', onPress: () => linePrefix('# ') },
    { label: 'B', style: { fontWeight: '800' }, onPress: () => wrap('**') },
    { label: 'I', style: { fontStyle: 'italic' }, onPress: () => wrap('*') },
    { label: 'H', style: { backgroundColor: '#fff475', color: '#202124' }, onPress: () => wrap('==') },
    { label: 'S', style: { textDecorationLine: 'line-through' }, onPress: () => wrap('~~') },
    { label: '• List', onPress: () => linePrefix('- ') },
    { label: '🔗 Link', onPress: link },
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
  h1: { fontSize: 22, fontWeight: '700', color: UI.text, lineHeight: 30 },
  h2: { fontSize: 18, fontWeight: '700', color: UI.text, lineHeight: 26 },
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
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
