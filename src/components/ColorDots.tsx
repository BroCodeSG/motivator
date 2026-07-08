import { Pressable, StyleSheet, View } from 'react-native';

import { PAGE_COLORS, UI } from '@/theme';

export function ColorDots({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  return (
    <View style={styles.row}>
      {Object.entries(PAGE_COLORS).map(([key, hex]) => (
        <Pressable
          key={key}
          onPress={() => onSelect(key)}
          style={[styles.dot, { backgroundColor: hex }, selected === key && styles.selected]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 8 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: UI.border,
  },
  selected: { borderWidth: 3, borderColor: UI.accent },
});
