import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { UI } from '@/theme';

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '');
}

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const tag = normalizeTag(draft);
    setDraft('');
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
  };

  return (
    <View style={styles.wrap}>
      {tags.map((tag) => (
        <View key={tag} style={styles.chip}>
          <Text style={styles.chipText}>#{tag}</Text>
          <Pressable hitSlop={8} onPress={() => onChange(tags.filter((t) => t !== tag))}>
            <Text style={styles.chipRemove}>✕</Text>
          </Pressable>
        </View>
      ))}
      <TextInput
        style={styles.input}
        placeholder="Add tag"
        placeholderTextColor={UI.textMuted}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addTag}
        onEndEditing={addTag}
        autoCapitalize="none"
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: UI.text, fontSize: 13 },
  chipRemove: { color: UI.textMuted, fontSize: 12 },
  input: { minWidth: 90, fontSize: 14, color: UI.text, paddingVertical: 4 },
});
