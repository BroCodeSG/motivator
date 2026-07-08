import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { signIn } from '@/lib/auth';
import { useSession } from '@/lib/session-context';
import { UI } from '@/theme';

export function LoginScreen() {
  const { login } = useSession();
  const [idNumber, setIdNumber] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const id = idNumber.trim();
    if (!/^\d{6,}$/.test(id)) {
      setError('Enter your ID number (digits only).');
      return;
    }
    if (!/^\d{4,}$/.test(pin)) {
      setError('Choose a PIN of at least 4 digits.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(id, pin);
      if (result.ok) {
        login(id);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Could not reach the server. Check your internet connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>💪 TBKA</Text>
      <Text style={styles.tagline}>The Better Keeps App</Text>
      <Text style={styles.subtitle}>
        Sign in once with your ID number and a PIN.{'\n'}New ID number? That creates your account.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="ID number"
        placeholderTextColor={UI.textMuted}
        keyboardType="number-pad"
        value={idNumber}
        onChangeText={setIdNumber}
        maxLength={13}
      />
      <TextInput
        style={styles.input}
        placeholder="PIN"
        placeholderTextColor={UI.textMuted}
        keyboardType="number-pad"
        secureTextEntry
        value={pin}
        onChangeText={setPin}
        maxLength={10}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.background, padding: 28, justifyContent: 'center', gap: 12 },
  logo: { fontSize: 30, fontWeight: '700', color: UI.text, textAlign: 'center' },
  tagline: { color: UI.textMuted, textAlign: 'center', marginTop: -6 },
  subtitle: { color: UI.textMuted, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: UI.text,
  },
  error: { color: UI.danger, textAlign: 'center' },
  button: {
    backgroundColor: UI.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: UI.onAccent, fontSize: 16, fontWeight: '600' },
});
