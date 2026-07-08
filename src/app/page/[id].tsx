import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ColorDots } from '@/components/ColorDots';
import { TagEditor } from '@/components/TagEditor';
import { TimeRow } from '@/components/TimeRow';
import {
  addItem,
  removeItem,
  setColor,
  setItemText,
  setReminder,
  setTags,
  setTitle,
  toggleItem,
} from '@/lib/pages';
import { usePage } from '@/lib/pages-context';
import { currentPeriodKey } from '@/lib/periods';
import { pageColor, UI } from '@/theme';
import type { IntervalType, ReminderTime } from '@/types';

const INTERVALS: IntervalType[] = ['daily', 'weekly', 'monthly'];

function defaultTime(interval: IntervalType): ReminderTime {
  if (interval === 'weekly') return { hour: 8, minute: 0, weekday: 2 }; // Monday
  if (interval === 'monthly') return { hour: 8, minute: 0, day: 1 };
  return { hour: 8, minute: 0 };
}

export default function PageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const page = usePage(id);
  const router = useRouter();
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');

  if (!page) {
    return (
      <View style={styles.missing}>
        <Text style={{ color: UI.textMuted }}>This page no longer exists.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: UI.accent, marginTop: 8 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const submitNewItem = () => {
    const text = newItem.trim();
    if (!text) return;
    addItem(page, text);
    setNewItem('');
  };

  const changeInterval = (interval: IntervalType) => {
    if (!page.reminder || page.reminder.interval === interval) return;
    const times = page.reminder.times.map((t) => {
      const base: ReminderTime = { hour: t.hour, minute: t.minute };
      if (interval === 'weekly') base.weekday = t.weekday ?? 2;
      if (interval === 'monthly') base.day = t.day ?? 1;
      return base;
    });
    setReminder(page.id, { interval, times }, currentPeriodKey(interval, new Date()));
  };

  const changeTime = (index: number, t: ReminderTime | null) => {
    if (!page.reminder) return;
    const times = page.reminder.times.flatMap((old, i) => (i === index ? (t ? [t] : []) : [old]));
    setReminder(page.id, { ...page.reminder, times }, page.lastResetPeriodKey);
  };

  const addTime = () => {
    if (!page.reminder) return;
    setReminder(
      page.id,
      { ...page.reminder, times: [...page.reminder.times, defaultTime(page.reminder.interval)] },
      page.lastResetPeriodKey
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerStyle: { backgroundColor: pageColor(page.color) } }} />
      <ScrollView
        style={[styles.container, { backgroundColor: pageColor(page.color) }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={styles.title}
          value={titleDraft ?? page.title}
          placeholder="Title"
          placeholderTextColor={UI.textMuted}
          onChangeText={setTitleDraft}
          onEndEditing={() => {
            if (titleDraft !== null && titleDraft.trim() !== page.title) {
              setTitle(page.id, titleDraft.trim());
            }
            setTitleDraft(null);
          }}
        />

        {page.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            {page.type === 'reminder' && (
              <Pressable hitSlop={8} onPress={() => toggleItem(page, item.id)}>
                <Text style={styles.checkbox}>{item.checked ? '☑' : '☐'}</Text>
              </Pressable>
            )}
            {page.type === 'list' && <Text style={styles.bullet}>•</Text>}
            <ItemText
              text={item.text}
              checked={item.checked}
              onCommit={(text) => {
                if (text.trim() && text.trim() !== item.text) setItemText(page, item.id, text.trim());
              }}
            />
            <Pressable hitSlop={10} onPress={() => removeItem(page, item.id)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.itemRow}>
          <Text style={styles.bullet}>＋</Text>
          <TextInput
            style={styles.itemInput}
            placeholder="Add item"
            placeholderTextColor={UI.textMuted}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={submitNewItem}
            blurOnSubmit={false}
            returnKeyType="done"
          />
        </View>

        {page.type === 'reminder' && page.reminder && (
          <View style={styles.reminderSection}>
            <Text style={styles.sectionLabel}>Reminders</Text>
            <View style={styles.segment}>
              {INTERVALS.map((i) => {
                const active = page.reminder!.interval === i;
                return (
                  <Pressable
                    key={i}
                    style={[styles.segmentButton, active && styles.segmentActive]}
                    onPress={() => changeInterval(i)}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{i}</Text>
                  </Pressable>
                );
              })}
            </View>

            {page.reminder.times.map((t, i) => (
              <TimeRow
                key={i}
                interval={page.reminder!.interval}
                time={t}
                onChange={(next) => changeTime(i, next)}
                onRemove={() => changeTime(i, null)}
              />
            ))}

            <Pressable onPress={addTime}>
              <Text style={styles.addTime}>＋ Add time</Text>
            </Pressable>
            {page.reminder.times.length === 0 && (
              <Text style={styles.hint}>No times set — this page won't send reminders yet.</Text>
            )}
            <Text style={styles.hint}>
              Reminders only fire while items are unticked. Ticks reset each{' '}
              {page.reminder.interval === 'daily'
                ? 'day'
                : page.reminder.interval === 'weekly'
                  ? 'week (Monday)'
                  : 'month (the 1st)'}
              .
            </Text>
          </View>
        )}

        <View style={styles.colorSection}>
          <Text style={styles.sectionLabel}>Tags</Text>
          <TagEditor tags={page.tags} onChange={(tags) => setTags(page.id, tags)} />
        </View>

        <View style={styles.colorSection}>
          <Text style={styles.sectionLabel}>Color</Text>
          <ColorDots selected={page.color} onSelect={(c) => setColor(page.id, c)} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ItemText({
  text,
  checked,
  onCommit,
}: {
  text: string;
  checked: boolean;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextInput
      style={[styles.itemInput, checked && styles.checkedText]}
      value={draft ?? text}
      onChangeText={setDraft}
      onEndEditing={() => {
        if (draft !== null) onCommit(draft);
        setDraft(null);
      }}
      multiline
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: UI.text,
    paddingVertical: 6,
    marginBottom: 10,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  checkbox: { fontSize: 20, color: UI.text },
  bullet: { fontSize: 16, color: UI.textMuted, width: 20, textAlign: 'center' },
  itemInput: { flex: 1, fontSize: 16, color: UI.text, paddingVertical: 6 },
  checkedText: { textDecorationLine: 'line-through', color: UI.textMuted },
  remove: { color: UI.textMuted, fontSize: 14, paddingHorizontal: 4 },
  reminderSection: { marginTop: 28, gap: 8 },
  colorSection: { marginTop: 28 },
  sectionLabel: { fontSize: 13, color: UI.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  segmentActive: { backgroundColor: '#fff', borderColor: UI.accent },
  segmentText: { color: UI.textMuted, textTransform: 'capitalize' },
  segmentTextActive: { color: UI.accent, fontWeight: '600' },
  addTime: { color: UI.accent, fontWeight: '600', paddingVertical: 6 },
  hint: { fontSize: 12, color: UI.textMuted },
});
