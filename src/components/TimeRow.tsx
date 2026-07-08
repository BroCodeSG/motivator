import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UI } from '@/theme';
import type { IntervalType, ReminderTime } from '@/types';

// expo-notifications weekday convention: 1 = Sunday .. 7 = Saturday
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function fmt(n: number): string {
  return n.toString().padStart(2, '0');
}

export function TimeRow({
  interval,
  time,
  onChange,
  onRemove,
}: {
  interval: IntervalType;
  time: ReminderTime;
  onChange: (t: ReminderTime) => void;
  onRemove: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={styles.row}>
      {interval === 'weekly' && (
        <View style={styles.weekdays}>
          {WEEKDAYS.map((label, i) => {
            const weekday = i + 1;
            const active = (time.weekday ?? 2) === weekday;
            return (
              <Pressable
                key={weekday}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChange({ ...time, weekday })}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {interval === 'monthly' && (
        <View style={styles.stepper}>
          <Pressable
            hitSlop={8}
            onPress={() => onChange({ ...time, day: Math.max(1, (time.day ?? 1) - 1) })}
          >
            <Text style={styles.stepButton}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>Day {time.day ?? 1}</Text>
          <Pressable
            hitSlop={8}
            onPress={() => onChange({ ...time, day: Math.min(28, (time.day ?? 1) + 1) })}
          >
            <Text style={styles.stepButton}>＋</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.timeButton} onPress={() => setPickerOpen(true)}>
        <Text style={styles.timeText}>
          {fmt(time.hour)}:{fmt(time.minute)}
        </Text>
      </Pressable>

      <Pressable hitSlop={10} onPress={onRemove}>
        <Text style={styles.remove}>✕</Text>
      </Pressable>

      {pickerOpen && (
        <DateTimePicker
          mode="time"
          is24Hour
          value={new Date(2000, 0, 1, time.hour, time.minute)}
          onValueChange={(event, date) => {
            setPickerOpen(false);
            onChange({ ...time, hour: date.getHours(), minute: date.getMinutes() });
          }}
          onDismiss={() => setPickerOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, flexWrap: 'wrap' },
  weekdays: { flexDirection: 'row', gap: 4 },
  chip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: UI.accent, borderColor: UI.accent },
  chipText: { fontSize: 12, color: UI.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { fontSize: 18, color: UI.accent, paddingHorizontal: 6 },
  stepValue: { color: UI.text, minWidth: 54, textAlign: 'center' },
  timeButton: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 'auto',
  },
  timeText: { fontSize: 15, color: UI.text, fontVariant: ['tabular-nums'] },
  remove: { color: UI.textMuted, fontSize: 15, paddingHorizontal: 4 },
});
