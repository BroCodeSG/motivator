import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pageColor, UI } from '@/theme';
import type { Page } from '@/types';

const INTERVAL_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', once: 'Once' };

function reminderBadge(page: Page): string {
  const r = page.reminder!;
  if (r.interval === 'once') {
    return r.onceAt ? `🔔 ${format(new Date(r.onceAt), 'EEE d MMM HH:mm')}` : '🔔 Once (no date set)';
  }
  return `🔔 ${INTERVAL_LABEL[r.interval]}${r.times.length > 0 ? ` ×${r.times.length}` : ' (no times set)'}`;
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
  const preview = page.items.slice(0, 4);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, { backgroundColor: pageColor(page.color) }]}
    >
      <Text style={styles.title} numberOfLines={1}>
        {page.title || 'Untitled'}
      </Text>
      {preview.map((item) => (
        <Text key={item.id} style={[styles.item, item.checked && styles.checked]} numberOfLines={1}>
          {page.type === 'reminder' ? (item.checked ? '☑ ' : '☐ ') : '• '}
          {item.text}
        </Text>
      ))}
      {page.items.length > 4 && <Text style={styles.more}>+{page.items.length - 4} more</Text>}
      {page.notes !== '' && (
        <Text style={styles.notes} numberOfLines={2}>
          {page.notes}
        </Text>
      )}
      {page.type === 'reminder' && page.reminder && (
        <Text style={styles.badge}>{reminderBadge(page)}</Text>
      )}
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
  title: { fontSize: 16, fontWeight: '600', color: UI.text, marginBottom: 6 },
  item: { fontSize: 13, color: UI.text, marginBottom: 2 },
  checked: { textDecorationLine: 'line-through', color: UI.textMuted },
  more: { fontSize: 12, color: UI.textMuted, marginTop: 2 },
  notes: { fontSize: 12, color: UI.textMuted, marginTop: 6, fontStyle: 'italic' },
  badge: { fontSize: 12, color: UI.textMuted, marginTop: 8 },
  tags: { fontSize: 11, color: UI.textMuted, marginTop: 4 },
});
