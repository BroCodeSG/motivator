import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pageColor, UI } from '@/theme';
import type { Page } from '@/types';

const INTERVAL_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

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
      {page.type === 'reminder' && page.reminder && (
        <Text style={styles.badge}>
          🔔 {INTERVAL_LABEL[page.reminder.interval]}
          {page.reminder.times.length > 0 ? ` ×${page.reminder.times.length}` : ' (no times set)'}
        </Text>
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
  badge: { fontSize: 12, color: UI.textMuted, marginTop: 8 },
  tags: { fontSize: 11, color: UI.textMuted, marginTop: 4 },
});
