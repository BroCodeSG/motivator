import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UI } from '@/theme';

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable style={styles.row} onPress={() => onChange(!value)}>
      <View style={[styles.box, value && styles.boxOn]}>
        {value && <Text style={styles.tick}>✓</Text>}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: UI.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: UI.accent, borderColor: UI.accent },
  tick: { color: UI.onAccent, fontSize: 14, fontWeight: '700' },
  label: { fontSize: 15, color: UI.text },
});
