import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pageColor, UI } from '@/theme';
import type { Page } from '@/types';

const INTERVAL_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

function badge(page: Page): string | null {
  if (page.type === 'reminder') {
    return page.onceAt ? `🔔 ${format(new Date(page.onceAt), 'EEE d MMM HH:mm')}` : '🔔 No date set';
  }
  if (page.type === 'reminderList' && page.reminder) {
    const r = page.reminder;
    return `🔁 ${INTERVAL_LABEL[r.interval]}${r.times.length ? ` ×${r.times.length}` : ' (no times)'}`;
  }
  return null;
}

export function PageCard({
  page,
  onPress,
  onLongPress,
}: {
  page: Page;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const checkable = page.type === 'reminder' || page.type === 'reminderList';
  const preview = page.items.slice(0, 4);
  const info = badge(page);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, { backgroundColor: pageColor(page.color) }, page.archived && styles.archived]}
    >
      <Text style={styles.title} numberOfLines={1}>
        {page.title || 'Untitled'}
      </Text>
      {preview.map((item) => (
        <View key={item.id}>
          <Text style={[styles.item, item.checked && styles.checked]} numberOfLines={1}>
            {checkable ? (item.checked ? '☑ ' : '☐ ') : '• '}
            {item.text}
          </Text>
          {item.note !== '' && (
            <Text style={styles.itemNote} numberOfLines={1}>
              {item.note}
            </Text>
          )}
        </View>
      ))}
      {page.items.length > 4 && <Text style={styles.more}>+{page.items.length - 4} more</Text>}
      {info && <Text style={styles.badge}>{info}</Text>}
      {page.archived && <Text style={styles.archivedTag}>Archived</Text>}
      {page.tags.length > 0 && (
        <Text style={styles.tags} numberOfLines={1}>
          {page.tags.map((t) => `#${t}`).join(' ')}
        </Text>
      )}
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
  title: { fontSize: 16, fontWeight: '600', color: UI.text, marginBottom: 6 },
  item: { fontSize: 13, color: UI.text, marginBottom: 2 },
  itemNote: { fontSize: 11, color: UI.textMuted, marginLeft: 16, marginBottom: 2 },
  checked: { textDecorationLine: 'line-through', color: UI.textMuted },
  more: { fontSize: 12, color: UI.textMuted, marginTop: 2 },
  badge: { fontSize: 12, color: UI.textMuted, marginTop: 8 },
  archivedTag: { fontSize: 11, color: UI.textMuted, marginTop: 4, fontStyle: 'italic' },
  tags: { fontSize: 11, color: UI.textMuted, marginTop: 4 },
});
