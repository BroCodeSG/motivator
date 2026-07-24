import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ColorDots } from '@/components/ColorDots';
import { OnceField, defaultOnceDate, toLocalIso } from '@/components/OnceField';
import { RichHtmlEditor } from '@/components/RichHtmlEditor';
import { TagEditor } from '@/components/TagEditor';
import { TimeRow } from '@/components/TimeRow';
import { Toggle } from '@/components/Toggle';
import { createPage } from '@/lib/pages';
import { usePages } from '@/lib/pages-context';
import { DEFAULT_COLOR, UI } from '@/theme';
import { newItemId, PAGE_TYPE_LABEL, type IntervalType, type PageType, type ReminderTime } from '@/types';

const TYPES: PageType[] = ['note', 'reminderList'];
const TYPE_ICON: Record<PageType, string> = { note: '📝', reminderList: '🔁' };
const INTERVALS: IntervalType[] = ['daily', 'weekly', 'monthly'];

function defaultTime(interval: IntervalType): ReminderTime {
  if (interval === 'weekly') return { hour: 8, minute: 0, weekday: 2 };
  if (interval === 'monthly') return { hour: 8, minute: 0, day: 1 };
  return { hour: 8, minute: 0 };
}

interface DraftItem {
  id: string;
  text: string;
  note: string;
}

export default function NewPageScreen() {
  const router = useRouter();
  const { pages } = usePages();
  const [type, setType] = useState<PageType>('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notify, setNotify] = useState(false);
  const [onceAt, setOnceAt] = useState<string>(toLocalIso(defaultOnceDate()));
  const [interval, setInterval] = useState<IntervalType>('daily');
  const [times, setTimes] = useState<ReminderTime[]>([]);
  const [items, setItems] = useState<DraftItem[]>([{ id: newItemId(), text: '', note: '' }]);
  const [checklist, setChecklist] = useState(false); // note sub-style: tick-box note
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [tags, setTags] = useState<string[]>([]);
  const [sendPush, setSendPush] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  const isList = type === 'reminderList';
  const hasItems = isList || (type === 'note' && checklist);
  const allTags = [...new Set(pages.flatMap((p) => p.tags))].sort();
  const canCreate = title.trim().length > 0;

  const create = async () => {
    if (saving || !canCreate) return;
    setSaving(true);
    const position = pages.reduce((max, p) => Math.max(max, p.position), 0) + 1;
    const id = await createPage({
      title: title.trim(),
      type,
      color,
      position,
      tags,
      checklist: type === 'note' ? checklist : undefined,
      body: hasItems ? undefined : body,
      notifyEnabled: isList ? undefined : notify,
      onceAt: !isList && notify ? onceAt : undefined,
      interval: isList ? interval : undefined,
      times: isList ? times : undefined,
      items: hasItems ? items.map((i) => ({ text: i.text, note: i.note })) : undefined,
      sendPush: isList || notify ? sendPush : undefined,
      sendEmail: isList || notify ? sendEmail : undefined,
    });
    router.replace(`/page/${id}`);
  };

  const renderItemsEditor = () => (
    <>
      {items.map((item) => (
        <View key={item.id} style={styles.itemBlock}>
          <View style={styles.itemHeaderRow}>
            <Text style={styles.checkbox}>☐</Text>
            <TextInput
              style={styles.itemInput}
              placeholder="Item"
              placeholderTextColor={UI.textMuted}
              value={item.text}
              onChangeText={(text) => setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, text } : it)))}
            />
            <Pressable hitSlop={10} onPress={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
          <RichHtmlEditor
            value={item.note}
            onChange={(note) => setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, note } : it)))}
            placeholder="Note for this item…"
          />
        </View>
      ))}
      <Pressable
        style={styles.addItemButton}
        onPress={() => setItems((prev) => [...prev, { id: newItemId(), text: '', note: '' }])}
      >
        <Text style={styles.addItemButtonText}>＋ Add item</Text>
      </Pressable>
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'New',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={styles.headerButton}>‹ Back</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.segment}>
            {TYPES.map((t) => (
              <Pressable key={t} style={[styles.segmentButton, type === t && styles.segmentActive]} onPress={() => setType(t)}>
                <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>
                  {TYPE_ICON[t]} {PAGE_TYPE_LABEL[t]}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.titleInput, !canCreate && styles.titleInputRequired]}
            placeholder="Title (required)"
            placeholderTextColor={UI.textMuted}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          {!isList && (
            <>
              <View style={styles.segment}>
                <Pressable style={[styles.segmentButton, !checklist && styles.segmentActive]} onPress={() => setChecklist(false)}>
                  <Text style={[styles.segmentText, !checklist && styles.segmentTextActive]}>Text</Text>
                </Pressable>
                <Pressable style={[styles.segmentButton, checklist && styles.segmentActive]} onPress={() => setChecklist(true)}>
                  <Text style={[styles.segmentText, checklist && styles.segmentTextActive]}>☑ Checklist</Text>
                </Pressable>
              </View>

              {checklist ? renderItemsEditor() : <RichHtmlEditor value={body} onChange={setBody} placeholder="Write your note…" />}

              <View style={styles.section}>
                <Toggle label="🔔 Notify me" value={notify} onChange={setNotify} />
                {notify && (
                  <>
                    <OnceField value={onceAt} onChange={setOnceAt} />
                    <Toggle label="Phone notification" value={sendPush} onChange={setSendPush} />
                    <Toggle label="Email" value={sendEmail} onChange={setSendEmail} />
                    {sendEmail && <Text style={styles.hint}>Set your email address in Settings.</Text>}
                  </>
                )}
              </View>
            </>
          )}

          {isList && (
            <>
              <Text style={styles.label}>Repeat</Text>
              <View style={styles.segment}>
                {INTERVALS.map((i) => (
                  <Pressable key={i} style={[styles.segmentButton, interval === i && styles.segmentActive]} onPress={() => setInterval(i)}>
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
                <Text style={styles.addLink}>＋ Add time</Text>
              </Pressable>

              <View style={styles.section}>
                <Toggle label="Phone notification" value={sendPush} onChange={setSendPush} />
                <Toggle label="Email" value={sendEmail} onChange={setSendEmail} />
              </View>

              <Text style={styles.label}>Items</Text>
              {renderItemsEditor()}
            </>
          )}

          <Text style={styles.label}>Tags</Text>
          <TagEditor tags={tags} onChange={setTags} suggestions={allTags} />

          <Text style={styles.label}>Color</Text>
          <ColorDots selected={color} onSelect={setColor} />

          <Pressable
            style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
            onPress={create}
            disabled={saving || !canCreate}
          >
            <Text style={styles.createText}>{saving ? 'Creating…' : canCreate ? 'Create' : 'Enter a title to create'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.background },
  content: { padding: 20, paddingBottom: 60, alignItems: 'center' },
  card: { width: '100%', maxWidth: 560, gap: 14 },
  headerButton: { color: UI.accent, fontSize: 16, fontWeight: '600', paddingHorizontal: 14 },
  titleInput: {
    fontSize: 20,
    color: UI.text,
    fontFamily: UI.font,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    paddingVertical: 8,
    marginVertical: 6,
  },
  titleInputRequired: { borderBottomColor: UI.danger },
  label: { fontSize: 13, color: UI.textMuted, marginTop: 6, fontWeight: '600', textTransform: 'uppercase' },
  section: { marginTop: 8, gap: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: { flex: 1, borderWidth: 1, borderColor: UI.border, borderRadius: 8, padding: 12, alignItems: 'center' },
  segmentActive: { backgroundColor: 'rgba(138,180,248,0.15)', borderColor: UI.accent },
  segmentText: { color: UI.text, textTransform: 'capitalize', fontWeight: '600' },
  segmentTextActive: { color: UI.accent },
  itemBlock: { borderWidth: 1, borderColor: UI.border, borderRadius: 10, padding: 10, gap: 8, marginBottom: 4 },
  itemHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { fontSize: 22, color: UI.text },
  itemInput: { flex: 1, fontSize: 18, color: UI.text, fontWeight: '500', paddingVertical: 2 },
  remove: { color: UI.textMuted, fontSize: 14, paddingHorizontal: 4 },
  addLink: { color: UI.accent, fontWeight: '600', paddingVertical: 8 },
  addItemButton: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: UI.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addItemButtonText: { color: UI.accent, fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 12, color: UI.textMuted },
  createButton: { marginTop: 24, backgroundColor: UI.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
  createButtonDisabled: { opacity: 0.5 },
  createText: { color: UI.onAccent, fontSize: 16, fontWeight: '600' },
});
