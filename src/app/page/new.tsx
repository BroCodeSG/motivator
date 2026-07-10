import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ColorDots } from '@/components/ColorDots';
import { OnceField, defaultOnceDate, toLocalIso } from '@/components/OnceField';
import { RichTextEditor } from '@/components/RichText';
import { TimeRow } from '@/components/TimeRow';
import { Toggle } from '@/components/Toggle';
import { createPage } from '@/lib/pages';
import { usePages } from '@/lib/pages-context';
import { DEFAULT_COLOR, UI } from '@/theme';
import { newItemId, PAGE_TYPE_LABEL, type IntervalType, type PageType, type ReminderTime } from '@/types';

const TYPES: PageType[] = ['list', 'reminderList', 'reminder'];
const TYPE_ICON: Record<PageType, string> = { list: '📝', reminderList: '🔁', reminder: '🔔' };
const INTERVALS: IntervalType[] = ['daily', 'weekly', 'monthly'];

function defaultTime(interval: IntervalType): ReminderTime {
  if (interval === 'weekly') return { hour: 8, minute: 0, weekday: 2 };
  if (interval === 'monthly') return { hour: 8, minute: 0, day: 1 };
  return { hour: 8, minute: 0 };
}

export default function NewPageScreen() {
  const router = useRouter();
  const { pages } = usePages();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PageType>('reminderList');
  const [interval, setInterval] = useState<IntervalType>('daily');
  const [times, setTimes] = useState<ReminderTime[]>([]);
  const [onceAt, setOnceAt] = useState<string>(toLocalIso(defaultOnceDate()));
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [newItem, setNewItem] = useState('');
  const [body, setBody] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [sendPush, setSendPush] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  const isReminderType = type === 'reminder' || type === 'reminderList';
  const checkable = isReminderType;

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setItems((prev) => [...prev, { id: newItemId(), text }]);
    setNewItem('');
  };

  const create = async () => {
    if (saving) return;
    setSaving(true);
    const trailing = newItem.trim() ? [newItem.trim()] : [];
    const position = pages.reduce((max, p) => Math.max(max, p.position), 0) + 1;
    const id = await createPage({
      title: title.trim(),
      type,
      color,
      position,
      interval: type === 'reminderList' ? interval : undefined,
      times: type === 'reminderList' ? times : undefined,
      onceAt: type === 'reminder' ? onceAt : undefined,
      itemTexts: [...items.map((i) => i.text), ...trailing],
      body,
      sendPush: isReminderType ? sendPush : undefined,
      sendEmail: isReminderType ? sendEmail : undefined,
    });
    router.replace(`/page/${id}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
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
            <Pressable key={t} style={[styles.typeButton, type === t && styles.segmentActive]} onPress={() => setType(t)}>
              <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>
                {TYPE_ICON[t]} {PAGE_TYPE_LABEL[t]}
              </Text>
              <Text style={styles.typeHint}>
                {t === 'list'
                  ? 'A note — free text and an optional checklist'
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
                  onPress={() => {
                    setInterval(i);
                    setTimes((prev) => prev.map((t) => ({ hour: t.hour, minute: t.minute, ...(i === 'weekly' ? { weekday: t.weekday ?? 2 } : {}), ...(i === 'monthly' ? { day: t.day ?? 1 } : {}) })));
                  }}
                >
                  <Text style={[styles.segmentText, interval === i && styles.segmentTextActive]}>{i}</Text>
                </Pressable>
              ))}
            </View>
            {times.map((t, idx) => (
              <TimeRow
                key={idx}
                interval={interval}
                time={t}
                onChange={(next) => setTimes((prev) => prev.map((old, i) => (i === idx ? next : old)))}
                onRemove={() => setTimes((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}
            <Pressable onPress={() => setTimes((prev) => [...prev, defaultTime(interval)])}>
              <Text style={styles.addTime}>＋ Add time</Text>
            </Pressable>
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

        <Text style={styles.label}>Items</Text>
        {items.map((item, idx) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemGlyph}>{checkable ? '☐' : '•'}</Text>
            <Text style={styles.itemText}>{item.text}</Text>
            <Pressable hitSlop={10} onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.itemRow}>
          <Text style={styles.itemGlyph}>{checkable ? '☐' : '•'}</Text>
          <TextInput
            style={styles.itemInput}
            placeholder="Add item"
            placeholderTextColor={UI.textMuted}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={addItem}
            blurOnSubmit={false}
            returnKeyType="done"
          />
        </View>

        <Text style={styles.label}>Note</Text>
        <RichTextEditor value={body} onChange={setBody} placeholder="Write a note… (B/I for bold/italic)" />

        <Text style={styles.label}>Color</Text>
        <ColorDots selected={color} onSelect={setColor} />

        <Pressable style={styles.createButton} onPress={create} disabled={saving}>
          <Text style={styles.createText}>{saving ? 'Creating…' : 'Create'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.background },
  content: { padding: 20, paddingBottom: 60, alignItems: 'center' },
  card: { width: '100%', maxWidth: 560, gap: 8 },
  titleInput: {
    fontSize: 20,
    color: UI.text,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    paddingVertical: 8,
    marginBottom: 12,
  },
  label: { fontSize: 13, color: UI.textMuted, marginTop: 12, fontWeight: '600', textTransform: 'uppercase' },
  typeCol: { gap: 8 },
  typeButton: { borderWidth: 1, borderColor: UI.border, borderRadius: 8, padding: 12 },
  typeHint: { fontSize: 12, color: UI.textMuted, marginTop: 2 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: { flex: 1, borderWidth: 1, borderColor: UI.border, borderRadius: 8, padding: 12, alignItems: 'center' },
  segmentActive: { backgroundColor: 'rgba(138,180,248,0.15)', borderColor: UI.accent },
  segmentText: { color: UI.text, textTransform: 'capitalize', fontWeight: '600' },
  segmentTextActive: { color: UI.accent },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
  },
  itemGlyph: { fontSize: 18, color: UI.text },
  itemText: { flex: 1, fontSize: 15, color: UI.text },
  itemInput: { flex: 1, fontSize: 15, color: UI.text, paddingVertical: 2 },
  remove: { color: UI.textMuted, fontSize: 14, paddingHorizontal: 4 },
  addTime: { color: UI.accent, fontWeight: '600', paddingVertical: 6 },
  hint: { fontSize: 12, color: UI.textMuted },
  createButton: { marginTop: 24, backgroundColor: UI.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
  createText: { color: UI.onAccent, fontSize: 16, fontWeight: '600' },
});
