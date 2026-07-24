import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { htmlToPlain } from '@/lib/richtext';
import { pageColor, UI } from '@/theme';
import type { Page } from '@/types';

const INTERVAL_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

function badge(page: Page): string {
  if (page.type === 'note') {
    if (page.notifyEnabled && page.onceAt) return `🔔 ${format(new Date(page.onceAt), 'EEE d MMM HH:mm')}`;
    return '📝 Note';
  }
  const r = page.reminder;
  return `🔁 ${r ? INTERVAL_LABEL[r.interval] : 'Daily'}${r?.times.length ? ` ×${r.times.length}` : ''}`;
}

export function PageCard({
  page,
  onPress,
  onLongPress,
  onEdit,
  onDelete,
}: {
  page: Page;
  onPress: () => void;
  onLongPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const showItems = page.type === 'reminderList' || (page.type === 'note' && page.checklist);
  const bodyPreview = page.type === 'note' && !page.checklist ? htmlToPlain(page.body).split('\n').filter(Boolean).slice(0, 5) : [];
  const items = showItems ? page.items.slice(0, 4) : [];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, { backgroundColor: pageColor(page.color) }, page.archived && styles.archived]}
    >
      <Text style={styles.title} numberOfLines={1}>
        {page.title || 'Untitled'}
      </Text>

      {bodyPreview.map((line, i) => (
        <Text key={i} style={styles.item} numberOfLines={1}>
          {line}
        </Text>
      ))}

      {items.map((item) => (
        <Text key={item.id} style={[styles.item, item.checked && styles.checked]} numberOfLines={1}>
          {item.checked ? '☑ ' : '☐ '}
          {item.text}
        </Text>
      ))}
      {showItems && page.items.length > 4 && <Text style={styles.more}>+{page.items.length - 4} more</Text>}

      <Text style={styles.badge}>{badge(page)}</Text>
      {page.archived && <Text style={styles.archivedTag}>Archived</Text>}
      {page.tags.length > 0 && (
        <Text style={styles.tags} numberOfLines={1}>
          {page.tags.map((t) => `#${t}`).join(' ')}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable hitSlop={12} onPress={onEdit} style={styles.actionBtn}>
          <Text style={styles.actionIcon}>✎</Text>
        </Pressable>
        <Pressable hitSlop={12} onPress={onDelete} style={styles.actionBtn}>
          <Text style={styles.actionIcon}>🗑</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: UI.border,
    minHeight: 100,
  },
  archived: { opacity: 0.55 },
  title: { fontSize: 19, fontWeight: '700', color: UI.text, marginBottom: 8 },
  item: { fontSize: 13, color: UI.text, marginBottom: 2 },
  checked: { textDecorationLine: 'line-through', color: UI.textMuted },
  more: { fontSize: 12, color: UI.textMuted, marginTop: 2 },
  badge: { fontSize: 12, color: UI.textMuted, marginTop: 8 },
  archivedTag: { fontSize: 11, color: UI.textMuted, marginTop: 4, fontStyle: 'italic' },
  tags: { fontSize: 11, color: UI.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
  },
  actionIcon: { fontSize: 20, color: UI.text },
});
