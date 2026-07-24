import { format } from 'date-fns';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ColorDots } from '@/components/ColorDots';
import { OnceField } from '@/components/OnceField';
import { RichHtml } from '@/components/RichHtml';
import { RichHtmlEditor } from '@/components/RichHtmlEditor';
import { TagEditor } from '@/components/TagEditor';
import { TimeRow } from '@/components/TimeRow';
import { Toggle } from '@/components/Toggle';
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

// The Keep-style card shown when a tile is opened. The blurred backdrop is
// supplied by whoever renders this (so the home grid stays visible behind it).
export function PageDetailCard({
  id,
  initialEditing,
  onClose,
}: {
  id: string;
  initialEditing?: boolean;
  onClose: () => void;
}) {
  const page = usePage(id);
  const { pages } = usePages();
  const [editing, setEditing] = useState(!!initialEditing);
  const allTags = [...new Set(pages.flatMap((p) => p.tags))].sort();

  const toggleEdit = () => {
    if (editing) (globalThis as any).document?.activeElement?.blur?.();
    setEditing((e) => !e);
  };

  return (
    <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.modalCard, { backgroundColor: page ? pageColor(page.color) : UI.surface }]}>
        {!page ? (
          <View style={styles.missing}>
            <Text style={{ color: UI.textMuted }}>This page no longer exists.</Text>
            <Pressable onPress={onClose}>
              <Text style={[styles.iconBtnText, { color: UI.accent, marginTop: 10 }]}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {editing ? <EditView page={page} allTags={allTags} /> : <ReadView page={page} />}
            </ScrollView>
            <View style={styles.bottomBar}>
              <Pressable onPress={() => setArchived(page.id, !page.archived)} hitSlop={10} style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>{page.archived ? '📤' : '🗄'}</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable onPress={toggleEdit} hitSlop={10} style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>{editing ? '✓' : '✎'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  (globalThis as any).document?.activeElement?.blur?.();
                  onClose();
                }}
                hitSlop={10}
                style={styles.iconBtn}
              >
                <Text style={styles.iconBtnText}>✕</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function ReadView({ page }: { page: Page }) {
  const showItems = page.type === 'reminderList' || (page.type === 'note' && page.checklist);
  return (
    <>
      <Text style={styles.title}>{page.title || 'Untitled'}</Text>

      {page.archived && (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedText}>Archived — tap 📤 below to restore</Text>
        </View>
      )}

      {page.type === 'note' && page.notifyEnabled && <Text style={styles.summary}>{summary(page)}</Text>}

      {showItems ? (
        <>
          {page.items.length === 0 && <Text style={styles.hint}>No items. Tap ✎ to add some.</Text>}
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
        <Text style={styles.hint}>Empty note. Tap ✎ to write something.</Text>
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
          placeholder="Type an item…"
          placeholderTextColor={UI.textMuted}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={submitNewItem}
          blurOnSubmit={false}
          returnKeyType="done"
        />
      </View>
      <Pressable style={styles.addItemButton} onPress={submitNewItem}>
        <Text style={styles.addItemButtonText}>＋ Add item</Text>
      </Pressable>
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
              {INTERVALS.map((iv) => {
                const active = page.reminder!.interval === iv;
                return (
                  <Pressable key={iv} style={[styles.segmentButton, active && styles.segmentActive]} onPress={() => changeInterval(iv)}>
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{iv}</Text>
                  </Pressable>
                );
              })}
            </View>
            {page.reminder.times.map((t, ti) => (
              <TimeRow key={ti} interval={page.reminder!.interval} time={t} onChange={(next) => changeTime(ti, next)} onRemove={() => changeTime(ti, null)} />
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
    </>
  );
}

function DraftInput({ value, onCommit, style }: { value: string; onCommit: (t: string) => void; style: any }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) onCommit(draft);
    setDraft(null);
  };
  return <TextInput style={style} value={draft ?? value} onChangeText={setDraft} onEndEditing={commit} onBlur={commit} multiline />;
}

const styles = StyleSheet.create({
  modalWrap: { width: '100%', maxWidth: 620, maxHeight: '90%' },
  modalCard: { borderRadius: 16, overflow: 'hidden', maxHeight: '100%' },
  scroll: { flexShrink: 1 },
  modalContent: { padding: 20, paddingBottom: 12 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  iconBtnText: { fontSize: 18, color: UI.text },
  missing: { padding: 40, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: UI.text, marginBottom: 8 },
  titleInput: { fontSize: 22, fontWeight: '600', color: UI.text, paddingVertical: 6, marginBottom: 10 },
  editingLabel: { fontSize: 12, color: UI.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  summary: { fontSize: 13, color: UI.textMuted, marginBottom: 14 },
  summaryUnder: { fontSize: 13, color: UI.textMuted, marginTop: 16 },
  archivedBanner: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 10, marginBottom: 12 },
  archivedText: { color: UI.text, fontWeight: '600' },
  readItem: { marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  checkbox: { fontSize: 24, color: UI.text },
  itemText: { flex: 1, fontSize: 18, color: UI.text, fontWeight: '500' },
  itemInput: { flex: 1, fontSize: 17, color: UI.text, paddingVertical: 6 },
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
  addItemButton: { marginTop: 8, borderWidth: 1, borderColor: UI.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addItemButtonText: { color: UI.accent, fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 12, color: UI.textMuted },
  readTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  readTag: { fontSize: 13, color: UI.textMuted },
});
