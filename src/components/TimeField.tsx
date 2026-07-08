import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { UI } from '@/theme';

function fmt(n: number): string {
  return n.toString().padStart(2, '0');
}

// Native time field: button that opens the system clock picker.
// TimeField.web.tsx replaces this with an <input type="time"> on web.
export function TimeField({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={styles.button} onPress={() => setOpen(true)}>
        <Text style={styles.text}>
          {fmt(hour)}:{fmt(minute)}
        </Text>
      </Pressable>
      {open && (
        <DateTimePicker
          mode="time"
          is24Hour
          value={new Date(2000, 0, 1, hour, minute)}
          onValueChange={(event, date) => {
            setOpen(false);
            onChange(date.getHours(), date.getMinutes());
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: { fontSize: 15, color: UI.text, fontVariant: ['tabular-nums'] },
});
