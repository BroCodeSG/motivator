import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ColorDots } from '@/components/ColorDots';
import { OnceField } from '@/components/OnceField';
import { RichHtml } from '@/components/RichHtml';
import { RichHtmlEditor } from '@/components/RichHtmlEditor';
import { TagEditor } from '@/components/TagEditor';
import { TimeRow } from '@/components/TimeRow';
import { Toggle } from '@/components/Toggle';
import { confirmAction } from '@/lib/confirm';
import {
  addItem,
  removeItem,
  setArchived,
  setBody,
  setChecklist,
  setColor,
  setItemNote,
  setItemText,
  setNotifyEnabled,
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
import { PAGE_TYPE_LABEL, type IntervalType, type Page, type ReminderTime } from '@/types';

const INTERVALS: IntervalType[] = ['daily', 'weekly', 'monthly'];
const TYPE_ICON: Record<Page['type'], string> = { note: '📝', reminderList: '🔁' };

function defaultTime(interval: IntervalType): ReminderTime {
  if (interval === 'weekly') return { hour: 8, minute: 0, weekday: 2 };
  if (interval === 'monthly') return { hour: 8, minute: 0, day: 1 };
  return { hour: 8, minute: 0 };
}

function summary(page: Page): string {
  if (page.type === 'note') {
    if (page.notifyEnabled && page.onceAt) return `🔔 ${format(new Date(page.onceAt), 'EEE d MMM, HH:mm')}`;
    return '📝 Note';
  }
  const r = page.reminder;
  const label = r ? r.interval.charAt(0).toUpperCase() + r.interval.slice(1) : 'Daily';
  return `🔁 ${label}${r?.times.length ? ` · ${r.times.length} time(s)` : ' · no times'}`;
}

export default function PageDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const page = usePage(id);
  const { pages } = usePages();
  const router = useRouter();
  const [editing, setEditing] = useState(edit === '1');
  const allTags = [...new Set(pages.flatMap((p) => p.tags))].sort();

  const close = () => {
    (globalThis as any).document?.activeElement?.blur?.();
    router.back();
  };
  const toggleEdit = () => {
    if (editing) (globalThis as any).document?.activeElement?.blur?.();
    setEditing((e) => !e);
  };

  const webBlur: any =
    Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {};

  return (
    <View style={[styles.backdrop, webBlur]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalCard, { backgroundColor: page ? pageColor(page.color) : UI.surface }]}>
          <View style={styles.topBar}>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={styles.headerButton}>✕</Text>
            </Pressable>
            {page && (
              <Pressable onPress={toggleEdit} hitSlop={10}>
                <Text style={styles.headerButton}>{editing ? 'Done' : 'Edit'}</Text>
              </Pressable>
            )}
          </View>
          {!page ? (
            <View style={styles.missing}>
              <Text style={{ color: UI.textMuted }}>This page no longer exists.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {editing ? <EditView page={page} allTags={allTags} /> : <ReadView page={page} />}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ReadView({ page }: { page: Page }) {
  const showItems = page.type === 'reminderList' || (page.type === 'note' && page.checklist);
  return (
    <>
      <Text style={styles.title}>{page.title || 'Untitled'}</Text>

      {page.archived ? (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedText}>Archived</Text>
          <Pressable onPress={() => setArchived(page.id, false)}>
            <Text style={styles.link}>Restore</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.viewActions}>
          <Pressable onPress={() => setArchived(page.id, true)}>
            <Text style={styles.link}>Archive</Text>
          </Pressable>
        </View>
      )}

      {/* Note reminders show the time up top; recurring lists show the schedule below the items. */}
      {page.type === 'note' && page.notifyEnabled && <Text style={styles.summary}>{summary(page)}</Text>}

      {showItems ? (
        <>
          {page.items.length === 0 && <Text style={styles.hint}>No items. Tap Edit to add some.</Text>}
          {page.items.map((item) => (
            <View key={item.id} style={styles.readItem}>
              <View style={styles.itemRow}>
                <Pressable hitSlop={8} onPress={() => toggleItem(page, item.id)}>
                  <Text style={styles.checkbox}>{item.checked ? '☑' : '☐'}</Text>
                </Pressable>
                <Text style={[styles.itemText, item.checked && styles.checkedText]}>{item.text}</Text>
              </View>
              {item.note !== '' && (
                <View style={styles.itemNoteBox}>
                  <RichHtml value={item.note} style={styles.itemNoteText} />
                </View>
              )}
            </View>
          ))}
        </>
      ) : page.body !== '' ? (
        <RichHtml value={page.body} />
      ) : (
        <Text style={styles.hint}>Empty note. Tap Edit to write something.</Text>
      )}

      {page.type === 'reminderList' && <Text style={styles.summaryUnder}>{summary(page)}</Text>}

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

function EditView({ page, allTags }: { page: Page; allTags: string[] }) {
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');

  const commitTitle = () => {
    if (titleDraft !== null && titleDraft.trim() !== page.title) setTitle(page.id, titleDraft.trim());
    setTitleDraft(null);
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

  const submitNewItem = () => {
    const text = newItem.trim();
    if (!text) return;
    addItem(page, text);
    setNewItem('');
  };

  const renderItems = () => (
    <>
      {page.items.map((item) => (
        <View key={item.id} style={styles.itemBlock}>
          <View style={styles.itemHeaderRow}>
            <Pressable hitSlop={8} onPress={() => toggleItem(page, item.id)}>
              <Text style={styles.checkbox}>{item.checked ? '☑' : '☐'}</Text>
            </Pressable>
            <DraftInput
              style={[styles.itemInput, item.checked && styles.checkedText]}
              value={item.text}
              onCommit={(text) => text.trim() && text.trim() !== item.text && setItemText(page, item.id, text.trim())}
            />
            <Pressable hitSlop={10} onPress={() => removeItem(page, item.id)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
          <RichHtmlEditor
            value={item.note}
            onCommit={(note) => note !== item.note && setItemNote(page, item.id, note)}
            placeholder="Note for this item…"
          />
        </View>
      ))}
      <View style={[styles.itemHeaderRow, styles.addRow]}>
        <Text style={styles.checkbox}>☐</Text>
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
    </>
  );

  return (
    <>
      <Text style={styles.editingLabel}>
        Editing {TYPE_ICON[page.type]} {PAGE_TYPE_LABEL[page.type]}
      </Text>
      <TextInput
        style={styles.titleInput}
        value={titleDraft ?? page.title}
        placeholder="Title"
        placeholderTextColor={UI.textMuted}
        onChangeText={setTitleDraft}
        onEndEditing={commitTitle}
        onBlur={commitTitle}
      />

      {page.type === 'note' && (
        <>
          <View style={styles.segment}>
            <Pressable style={[styles.segmentButton, !page.checklist && styles.segmentActive]} onPress={() => page.checklist && setChecklist(page.id, false)}>
              <Text style={[styles.segmentText, !page.checklist && styles.segmentTextActive]}>Text</Text>
            </Pressable>
            <Pressable style={[styles.segmentButton, page.checklist && styles.segmentActive]} onPress={() => !page.checklist && setChecklist(page.id, true)}>
              <Text style={[styles.segmentText, page.checklist && styles.segmentTextActive]}>☑ Checklist</Text>
            </Pressable>
          </View>

          {page.checklist ? (
            renderItems()
          ) : (
            <RichHtmlEditor value={page.body} onCommit={(t) => t !== page.body && setBody(page.id, t)} placeholder="Write your note…" />
          )}

          <View style={styles.section}>
            <Toggle label="🔔 Notify me" value={page.notifyEnabled} onChange={(v) => setNotifyEnabled(page.id, v)} />
            {page.notifyEnabled && (
              <>
                <OnceField value={page.onceAt} onChange={(v) => setOnceAt(page.id, v)} />
                <Toggle label="Phone notification" value={page.sendPush} onChange={(v) => setSendPush(page.id, v)} />
                <Toggle label="Email" value={page.sendEmail} onChange={(v) => setSendEmail(page.id, v)} />
                {page.sendEmail && <Text style={styles.hint}>Sent to the email in Settings.</Text>}
                <Text style={styles.hint}>Fires once at that time with the note, then archives itself.</Text>
              </>
            )}
          </View>
        </>
      )}

      {page.type === 'reminderList' && page.reminder && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Repeat</Text>
            <View style={styles.segment}>
              {INTERVALS.map((i) => {
                const active = page.reminder!.interval === i;
                return (
                  <Pressable key={i} style={[styles.segmentButton, active && styles.segmentActive]} onPress={() => changeInterval(i)}>
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{i}</Text>
                  </Pressable>
                );
              })}
            </View>
            {page.reminder.times.map((t, i) => (
              <TimeRow key={i} interval={page.reminder!.interval} time={t} onChange={(next) => changeTime(i, next)} onRemove={() => changeTime(i, null)} />
            ))}
            <Pressable onPress={addTime}>
              <Text style={styles.addLink}>＋ Add time</Text>
            </Pressable>
            <Toggle label="Phone notification" value={page.sendPush} onChange={(v) => setSendPush(page.id, v)} />
            <Toggle label="Email" value={page.sendEmail} onChange={(v) => setSendEmail(page.id, v)} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Items</Text>
            {renderItems()}
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Tags</Text>
        <TagEditor tags={page.tags} onChange={(tags) => setTags(page.id, tags)} suggestions={allTags} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Color</Text>
        <ColorDots selected={page.color} onSelect={(c) => setColor(page.id, c)} />
      </View>

      <Pressable
        style={styles.deleteRow}
        onPress={() =>
          confirmAction(
            page.archived ? 'Restore' : 'Archive',
            page.archived ? 'Move back to your active pages?' : 'Move to the archive?',
            page.archived ? 'Restore' : 'Archive',
            () => setArchived(page.id, !page.archived)
          )
        }
      >
        <Text style={styles.link}>{page.archived ? 'Restore from archive' : 'Archive this page'}</Text>
      </Pressable>
    </>
  );
}

function DraftInput({ value, onCommit, style }: { value: string; onCommit: (t: string) => void; style: any }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) onCommit(draft);
    setDraft(null);
  };
  return (
    <TextInput style={style} value={draft ?? value} onChangeText={setDraft} onEndEditing={commit} onBlur={commit} multiline />
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalWrap: { width: '100%', maxWidth: 620, maxHeight: '90%' },
  modalCard: { borderRadius: 16, overflow: 'hidden', maxHeight: '100%' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingTop: 10 },
  modalContent: { padding: 20, paddingTop: 8 },
  missing: { padding: 40, alignItems: 'center' },
  headerButton: { color: UI.accent, fontSize: 16, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 4 },
  title: { fontSize: 24, fontWeight: '700', color: UI.text, marginBottom: 8 },
  titleInput: { fontSize: 22, fontWeight: '600', color: UI.text, paddingVertical: 6, marginBottom: 10 },
  editingLabel: { fontSize: 12, color: UI.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  summary: { fontSize: 13, color: UI.textMuted, marginBottom: 14 },
  summaryUnder: { fontSize: 13, color: UI.textMuted, marginTop: 16 },
  viewActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  archivedBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 10, marginBottom: 12 },
  archivedText: { color: UI.text, fontWeight: '600' },
  link: { color: UI.accent, fontWeight: '600', paddingVertical: 4 },
  readItem: { marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  checkbox: { fontSize: 20, color: UI.text },
  itemText: { flex: 1, fontSize: 16, color: UI.text },
  itemInput: { flex: 1, fontSize: 16, color: UI.text, paddingVertical: 6 },
  itemNoteBox: { marginLeft: 30, marginTop: 2 },
  itemNoteText: { fontSize: 13, color: UI.textMuted },
  checkedText: { textDecorationLine: 'line-through', color: UI.textMuted },
  remove: { color: UI.textMuted, fontSize: 14, paddingHorizontal: 4 },
  section: { marginTop: 22, gap: 8 },
  sectionLabel: { fontSize: 13, color: UI.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: { flex: 1, borderWidth: 1, borderColor: UI.border, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  segmentActive: { backgroundColor: 'rgba(0,0,0,0.4)', borderColor: UI.accent },
  segmentText: { color: UI.textMuted, textTransform: 'capitalize' },
  segmentTextActive: { color: UI.accent, fontWeight: '600' },
  itemBlock: { borderWidth: 1, borderColor: UI.border, borderRadius: 10, padding: 10, gap: 8, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.12)' },
  itemHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addRow: { borderWidth: 1, borderColor: UI.border, borderStyle: 'dashed', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  addLink: { color: UI.accent, fontWeight: '600', paddingVertical: 6 },
  hint: { fontSize: 12, color: UI.textMuted },
  readTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  readTag: { fontSize: 13, color: UI.textMuted },
  deleteRow: { marginTop: 24, alignItems: 'center' },
});
