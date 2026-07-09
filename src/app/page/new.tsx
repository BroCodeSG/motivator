import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ColorDots } from '@/components/ColorDots';
import { OnceField, defaultOnceDate, toLocalIso } from '@/components/OnceField';
import { Toggle } from '@/components/Toggle';
import { createPage } from '@/lib/pages';
import { usePages } from '@/lib/pages-context';
import { DEFAULT_COLOR, UI } from '@/theme';
import type { IntervalType, PageType } from '@/types';
import { PAGE_TYPE_LABEL } from '@/types';

const TYPES: PageType[] = ['list', 'reminderList', 'reminder'];
const TYPE_ICON: Record<PageType, string> = { list: '📝', reminderList: '🔁', reminder: '🔔' };
const INTERVALS: IntervalType[] = ['daily', 'weekly', 'monthly'];

export default function NewPageScreen() {
  const router = useRouter();
  const { pages } = usePages();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PageType>('reminderList');
  const [interval, setInterval] = useState<IntervalType>('daily');
  const [onceAt, setOnceAt] = useState<string>(toLocalIso(defaultOnceDate()));
  const [itemsText, setItemsText] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [sendPush, setSendPush] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  const isReminderType = type === 'reminder' || type === 'reminderList';

  const create = async () => {
    if (saving) return;
    setSaving(true);
    const position = pages.reduce((max, p) => Math.max(max, p.position), 0) + 1;
    const id = await createPage({
      title: title.trim(),
      type,
      color,
      position,
      interval: type === 'reminderList' ? interval : undefined,
      onceAt: type === 'reminder' ? onceAt : undefined,
      itemTexts: itemsText.split('\n'),
      sendPush: isReminderType ? sendPush : undefined,
      sendEmail: isReminderType ? sendEmail : undefined,
    });
    router.replace(`/page/${id}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.titleInput}
        placeholder="Title"
        placeholderTextColor={UI.textMuted}
        value={title}
        onChangeText={setTitle}
        autoFocus
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.typeCol}>
        {TYPES.map((t) => (
          <Pressable
            key={t}
            style={[styles.typeButton, type === t && styles.segmentActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>
              {TYPE_ICON[t]} {PAGE_TYPE_LABEL[t]}
            </Text>
            <Text style={styles.typeHint}>
              {t === 'list'
                ? 'A plain list, no reminders'
                : t === 'reminderList'
                  ? 'Recurring checklist that reminds you daily/weekly/monthly'
                  : 'A one-off reminder for a single date & time'}
            </Text>
          </Pressable>
        ))}
      </View>

      {type === 'reminderList' && (
        <>
          <Text style={styles.label}>Repeat</Text>
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
          <Text style={styles.hint}>You can set the exact times after creating it.</Text>
        </>
      )}

      {type === 'reminder' && (
        <>
          <Text style={styles.label}>Remind me at</Text>
          <OnceField value={onceAt} onChange={setOnceAt} />
        </>
      )}

      {isReminderType && (
        <>
          <Text style={styles.label}>Notify by</Text>
          <Toggle label="🔔 Phone notification" value={sendPush} onChange={setSendPush} />
          <Toggle label="✉️ Email" value={sendEmail} onChange={setSendEmail} />
          {sendEmail && <Text style={styles.hint}>Set your email address in Settings (gear icon).</Text>}
        </>
      )}

      <Text style={styles.label}>Items (one per line, optional)</Text>
      <TextInput
        style={styles.itemsInput}
        placeholder={'Buy milk\nCall the dentist\n…'}
        placeholderTextColor={UI.textMuted}
        value={itemsText}
        onChangeText={setItemsText}
        multiline
      />

      <Text style={styles.label}>Color</Text>
      <ColorDots selected={color} onSelect={setColor} />

      <Pressable style={styles.createButton} onPress={create} disabled={saving}>
        <Text style={styles.createText}>{saving ? 'Creating…' : 'Create'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.background },
  content: { padding: 20, gap: 8, paddingBottom: 60 },
  titleInput: {
    fontSize: 20,
    color: UI.text,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    paddingVertical: 8,
    marginBottom: 12,
  },
  label: { fontSize: 13, color: UI.textMuted, marginTop: 12 },
  typeCol: { gap: 8 },
  typeButton: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 12,
  },
  typeHint: { fontSize: 12, color: UI.textMuted, marginTop: 2 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: 'rgba(138,180,248,0.15)', borderColor: UI.accent },
  segmentText: { color: UI.text, textTransform: 'capitalize', fontWeight: '600' },
  segmentTextActive: { color: UI.accent },
  itemsInput: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: UI.text,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 12, color: UI.textMuted },
  createButton: {
    marginTop: 24,
    backgroundColor: UI.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  createText: { color: UI.onAccent, fontSize: 16, fontWeight: '600' },
});
