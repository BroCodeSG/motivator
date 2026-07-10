import { format } from 'date-fns';
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
import { OnceField } from '@/components/OnceField';
import { TagEditor } from '@/components/TagEditor';
import { TimeRow } from '@/components/TimeRow';
import { Toggle } from '@/components/Toggle';
import { confirmAction } from '@/lib/confirm';
import {
  addItem,
  removeItem,
  setArchived,
  setColor,
  setItemNote,
  setItemText,
  setOnceAt,
  setReminder,
  setSendEmail,
  setSendPush,
  setTags,
  setTitle,
  toggleItem,
} from '@/lib/pages';
import { usePage, usePages } from '@/lib/pages-context';
import { pageColor, UI } from '@/theme';
import type { IntervalType, Page, ReminderTime } from '@/types';

const INTERVALS: IntervalType[] = ['daily', 'weekly', 'monthly'];
const INTERVAL_RESET = { daily: 'day', weekly: 'week (Monday)', monthly: 'month (the 1st)' };

function defaultTime(interval: IntervalType): ReminderTime {
  if (interval === 'weekly') return { hour: 8, minute: 0, weekday: 2 };
  if (interval === 'monthly') return { hour: 8, minute: 0, day: 1 };
  return { hour: 8, minute: 0 };
}

function reminderSummary(page: Page): string {
  if (page.type === 'reminder') {
    return page.onceAt ? `Once, ${format(new Date(page.onceAt), 'EEE d MMM yyyy, HH:mm')}` : 'Once — no date set';
  }
  if (page.type === 'reminderList' && page.reminder) {
    const r = page.reminder;
    const label = r.interval.charAt(0).toUpperCase() + r.interval.slice(1);
    return r.times.length ? `${label}, ${r.times.length} time(s)` : `${label} — no times set`;
  }
  return '';
}

export default function PageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const page = usePage(id);
  const { pages } = usePages();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const allTags = [...new Set(pages.flatMap((p) => p.tags))].sort();

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

  const checkable = page.type === 'reminder' || page.type === 'reminderList';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: pageColor(page.color) },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={styles.headerButton}>‹ Back</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => setEditing((e) => !e)} hitSlop={10}>
              <Text style={styles.headerButton}>{editing ? 'Done' : 'Edit'}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: pageColor(page.color) }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {editing ? (
            <EditView page={page} checkable={checkable} allTags={allTags} />
          ) : (
            <ReadView page={page} checkable={checkable} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---- Read-only view: tick items, read notes, tap Edit for everything else ----
function ReadView({ page, checkable }: { page: Page; checkable: boolean }) {
  return (
    <>
      <Text style={styles.title}>{page.title || 'Untitled'}</Text>

      {page.archived && (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedText}>Archived</Text>
          <Pressable onPress={() => setArchived(page.id, false)}>
            <Text style={styles.link}>Restore</Text>
          </Pressable>
        </View>
      )}

      {checkable && <Text style={styles.summary}>🔔 {reminderSummary(page)}</Text>}

      {page.items.length === 0 && <Text style={styles.hint}>No items. Tap Edit to add some.</Text>}

      {page.items.map((item) => (
        <View key={item.id} style={styles.readItem}>
          <View style={styles.itemRow}>
            {checkable ? (
              <Pressable hitSlop={8} onPress={() => toggleItem(page, item.id)}>
                <Text style={styles.checkbox}>{item.checked ? '☑' : '☐'}</Text>
              </Pressable>
            ) : (
              <Text style={styles.bullet}>•</Text>
            )}
            <Text style={[styles.itemText, item.checked && styles.checkedText]}>{item.text}</Text>
          </View>
          {item.note !== '' && <Text style={styles.itemNote}>{item.note}</Text>}
        </View>
      ))}

      {page.tags.length > 0 && (
        <View style={styles.readTags}>
          {page.tags.map((t) => (
            <Text key={t} style={styles.readTag}>
              #{t}
            </Text>
          ))}
        </View>
      )}
    </>
  );
}

// ---- Edit view: everything is editable ----
function EditView({ page, checkable, allTags }: { page: Page; checkable: boolean; allTags: string[] }) {
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');

  const commitTitle = () => {
    if (titleDraft !== null && titleDraft.trim() !== page.title) setTitle(page.id, titleDraft.trim());
    setTitleDraft(null);
  };

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
    setReminder(page.id, { interval, times }, '');
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
    <>
      <TextInput
        style={styles.titleInput}
        value={titleDraft ?? page.title}
        placeholder="Title"
        placeholderTextColor={UI.textMuted}
        onChangeText={setTitleDraft}
        onEndEditing={commitTitle}
        onBlur={commitTitle}
      />

      {page.items.map((item) => (
        <View key={item.id} style={styles.editItem}>
          <View style={styles.itemRow}>
            {checkable ? (
              <Pressable hitSlop={8} onPress={() => toggleItem(page, item.id)}>
                <Text style={styles.checkbox}>{item.checked ? '☑' : '☐'}</Text>
              </Pressable>
            ) : (
              <Text style={styles.bullet}>•</Text>
            )}
            <DraftInput
              style={[styles.itemInput, item.checked && styles.checkedText]}
              value={item.text}
              onCommit={(text) => {
                if (text.trim() && text.trim() !== item.text) setItemText(page, item.id, text.trim());
              }}
            />
            <Pressable hitSlop={10} onPress={() => removeItem(page, item.id)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
          <DraftInput
            style={styles.noteInput}
            value={item.note}
            placeholder="Add note…"
            onCommit={(note) => {
              if (note !== item.note) setItemNote(page, item.id, note.trim());
            }}
          />
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

      {page.type === 'reminderList' && page.reminder && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Repeat</Text>
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
          <Text style={styles.hint}>
            Reminds you while items are unticked. Ticks reset each {INTERVAL_RESET[page.reminder.interval]}.
          </Text>
        </View>
      )}

      {page.type === 'reminder' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Remind me at</Text>
          <OnceField value={page.onceAt} onChange={(v) => setOnceAt(page.id, v)} />
          <Text style={styles.hint}>Reminds you once, then archives itself. Ticking all items cancels it.</Text>
          <Pressable
            onPress={() =>
              confirmAction(
                page.archived ? 'Restore reminder' : 'Archive reminder',
                page.archived ? 'Move this back to your active pages?' : 'Move this to the archive now?',
                page.archived ? 'Restore' : 'Archive',
                () => setArchived(page.id, !page.archived)
              )
            }
          >
            <Text style={styles.link}>{page.archived ? 'Restore from archive' : 'Archive now'}</Text>
          </Pressable>
        </View>
      )}

      {checkable && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notify by</Text>
          <Toggle label="🔔 Phone notification" value={page.sendPush} onChange={(v) => setSendPush(page.id, v)} />
          <Toggle label="✉️ Email" value={page.sendEmail} onChange={(v) => setSendEmail(page.id, v)} />
          {page.sendEmail && <Text style={styles.hint}>Sent to the email address in Settings.</Text>}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Tags</Text>
        <TagEditor tags={page.tags} onChange={(tags) => setTags(page.id, tags)} suggestions={allTags} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Color</Text>
        <ColorDots selected={page.color} onSelect={(c) => setColor(page.id, c)} />
      </View>
    </>
  );
}

// Text input that keeps a local draft and commits on blur (onEndEditing does
// not fire on web).
function DraftInput({
  value,
  onCommit,
  style,
  placeholder,
}: {
  value: string;
  onCommit: (text: string) => void;
  style: any;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) onCommit(draft);
    setDraft(null);
  };
  return (
    <TextInput
      style={style}
      value={draft ?? value}
      placeholder={placeholder}
      placeholderTextColor={UI.textMuted}
      onChangeText={setDraft}
      onEndEditing={commit}
      onBlur={commit}
      multiline
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, alignItems: 'center' },
  card: { width: '100%', maxWidth: 680 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerButton: { color: UI.accent, fontSize: 16, fontWeight: '600', paddingHorizontal: 4 },
  title: { fontSize: 24, fontWeight: '700', color: UI.text, marginBottom: 10 },
  titleInput: { fontSize: 22, fontWeight: '600', color: UI.text, paddingVertical: 6, marginBottom: 10 },
  summary: { fontSize: 13, color: UI.textMuted, marginBottom: 14 },
  archivedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  archivedText: { color: UI.text, fontWeight: '600' },
  link: { color: UI.accent, fontWeight: '600', paddingVertical: 4 },
  readItem: { marginBottom: 8 },
  editItem: { marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  checkbox: { fontSize: 20, color: UI.text },
  bullet: { fontSize: 16, color: UI.textMuted, width: 20, textAlign: 'center' },
  itemText: { flex: 1, fontSize: 16, color: UI.text },
  itemInput: { flex: 1, fontSize: 16, color: UI.text, paddingVertical: 6 },
  itemNote: { fontSize: 13, color: UI.textMuted, marginLeft: 30, marginTop: 2 },
  noteInput: { fontSize: 13, color: UI.textMuted, marginLeft: 30, paddingVertical: 2 },
  checkedText: { textDecorationLine: 'line-through', color: UI.textMuted },
  remove: { color: UI.textMuted, fontSize: 14, paddingHorizontal: 4 },
  section: { marginTop: 26, gap: 8 },
  sectionLabel: { fontSize: 13, color: UI.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  segmentActive: { backgroundColor: 'rgba(0,0,0,0.4)', borderColor: UI.accent },
  segmentText: { color: UI.textMuted, textTransform: 'capitalize' },
  segmentTextActive: { color: UI.accent, fontWeight: '600' },
  addTime: { color: UI.accent, fontWeight: '600', paddingVertical: 6 },
  hint: { fontSize: 12, color: UI.textMuted },
  readTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  readTag: { fontSize: 13, color: UI.textMuted },
});
