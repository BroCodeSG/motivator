import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ColorDots } from '@/components/ColorDots';
import { createPage } from '@/lib/pages';
import { usePages } from '@/lib/pages-context';
import { DEFAULT_COLOR, UI } from '@/theme';
import type { IntervalType, PageType } from '@/types';

const INTERVALS: IntervalType[] = ['daily', 'weekly', 'monthly'];

export default function NewPageScreen() {
  const router = useRouter();
  const { pages } = usePages();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PageType>('reminder');
  const [interval, setInterval] = useState<IntervalType>('daily');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (saving) return;
    setSaving(true);
    const position = pages.reduce((max, p) => Math.max(max, p.position), 0) + 1;
    const id = await createPage({ title: title.trim(), type, color, interval, position });
    router.replace(`/page/${id}`);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.titleInput}
        placeholder="Title"
        placeholderTextColor={UI.textMuted}
        value={title}
        onChangeText={setTitle}
        autoFocus
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.segment}>
        {(['reminder', 'list'] as PageType[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.segmentButton, type === t && styles.segmentActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>
              {t === 'reminder' ? '🔔 Reminder' : '📝 List'}
            </Text>
          </Pressable>
        ))}
      </View>

      {type === 'reminder' && (
        <>
          <Text style={styles.label}>Remind me</Text>
          <View style={styles.segment}>
            {INTERVALS.map((i) => (
              <Pressable
                key={i}
                style={[styles.segmentButton, interval === i && styles.segmentActive]}
                onPress={() => setInterval(i)}
              >
                <Text style={[styles.segmentText, interval === i && styles.segmentTextActive]}>{i}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Color</Text>
      <ColorDots selected={color} onSelect={setColor} />

      <Pressable style={styles.createButton} onPress={create} disabled={saving}>
        <Text style={styles.createText}>{saving ? 'Creating…' : 'Create'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.background, padding: 20, gap: 8 },
  titleInput: {
    fontSize: 20,
    color: UI.text,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    paddingVertical: 8,
    marginBottom: 12,
  },
  label: { fontSize: 13, color: UI.textMuted, marginTop: 10 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#e8f0fe', borderColor: UI.accent },
  segmentText: { color: UI.textMuted, textTransform: 'capitalize' },
  segmentTextActive: { color: UI.accent, fontWeight: '600' },
  createButton: {
    marginTop: 24,
    backgroundColor: UI.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  createText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
