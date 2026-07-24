import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { htmlToPlain } from '@/lib/richtext';
import { UI } from '@/theme';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((l) => `<div>${esc(l) || '<br>'}</div>`)
    .join('');
}

// Native fallback editor. The full in-place WYSIWYG editor is web/WebView-based;
// on a bare React Native screen we edit the note as plain text and re-wrap it as
// HTML on change. (The installed-app WYSIWYG editor is wired in at APK build.)
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
  const [draft, setDraft] = useState<string | null>(null);
  const plain = draft ?? htmlToPlain(value);
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={plain}
        placeholder={placeholder}
        placeholderTextColor={UI.textMuted}
        onChangeText={(t) => {
          setDraft(t);
          onChange?.(textToHtml(t));
        }}
        onBlur={() => draft !== null && onCommit?.(textToHtml(draft))}
        multiline
      />
      <Text style={styles.hint}>Rich formatting is available on the web and the installed app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: UI.text,
    minHeight: 56,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  hint: { fontSize: 11, color: UI.textMuted },
});
