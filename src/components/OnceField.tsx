import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TimeField } from '@/components/TimeField';
import { UI } from '@/theme';

export function defaultOnceDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function toLocalIso(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

// Native date + time picker pair for once-off reminders.
// OnceField.web.tsx replaces this with an <input type="datetime-local">.
export function OnceField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (localIso: string) => void;
}) {
  const current = value ? new Date(value) : defaultOnceDate();
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <View style={styles.row}>
      <Pressable style={styles.dateButton} onPress={() => setDateOpen(true)}>
        <Text style={styles.dateText}>{format(current, 'EEE d MMM yyyy')}</Text>
      </Pressable>
      <TimeField
        hour={current.getHours()}
        minute={current.getMinutes()}
        onChange={(hour, minute) => {
          const d = new Date(current);
          d.setHours(hour, minute, 0, 0);
          onChange(toLocalIso(d));
        }}
      />
      {dateOpen && (
        <DateTimePicker
          mode="date"
          value={current}
          onValueChange={(event, date) => {
            setDateOpen(false);
            const d = new Date(date);
            d.setHours(current.getHours(), current.getMinutes(), 0, 0);
            onChange(toLocalIso(d));
          }}
          onDismiss={() => setDateOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, flexWrap: 'wrap' },
  dateButton: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateText: { fontSize: 15, color: UI.text },
});
