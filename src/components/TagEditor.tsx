import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { UI } from '@/theme';

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '');
}

export function TagEditor({
  tags,
  onChange,
  suggestions = [],
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    setDraft('');
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
  };

  // Existing tags on other pages that aren't already on this one, filtered by
  // what's typed so far.
  const q = normalizeTag(draft);
  const available = suggestions
    .filter((t) => !tags.includes(t))
    .filter((t) => (q ? t.includes(q) : true));

  return (
    <View style={styles.wrap}>
      <View style={styles.chipRow}>
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
          onSubmitEditing={() => add(draft)}
          onBlur={() => add(draft)}
          autoCapitalize="none"
          returnKeyType="done"
        />
      </View>

      {available.length > 0 && (
        <View style={styles.suggestRow}>
          {available.map((tag) => (
            <Pressable key={tag} style={styles.suggest} onPress={() => add(tag)}>
              <Text style={styles.suggestText}>+ #{tag}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
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
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggest: {
    borderWidth: 1,
    borderColor: UI.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  suggestText: { color: UI.textMuted, fontSize: 12 },
});
