import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import * as Notifications from 'expo-notifications';

import { FAB } from '@/components/FAB';
import { PageCard } from '@/components/PageCard';
import { reconcileAll, scheduledCount } from '@/lib/notifications';
import { deletePage } from '@/lib/pages';
import { usePages } from '@/lib/pages-context';
import { useSession } from '@/lib/session-context';
import { UI } from '@/theme';

export default function HomeScreen() {
  const { pages, ready } = usePages();
  const { userId, logout } = useSession();
  const router = useRouter();
  const [debugVisible, setDebugVisible] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const openDebug = async () => {
    setDebugVisible(true);
    setCount(await scheduledCount());
  };

  const resync = async () => {
    await reconcileAll(pages);
    setCount(await scheduledCount());
  };

  const signOut = () => {
    Alert.alert('Sign out', 'Reminders stop until you sign in again. Your data stays saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setDebugVisible(false);
          await Notifications.cancelAllScheduledNotificationsAsync();
          logout();
        },
      },
    ]);
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert('Delete page', `Delete "${title || 'Untitled'}" and all its items?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePage(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={openDebug} hitSlop={10}>
              <Text style={styles.gear}>⚙️</Text>
            </Pressable>
          ),
        }}
      />
      {pages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {ready ? 'No pages yet.\nTap ＋ to create your first one.' : 'Loading…'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={pages}
          numColumns={2}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <PageCard
              page={item}
              onPress={() => router.push(`/page/${item.id}`)}
              onLongPress={() => confirmDelete(item.id, item.title)}
            />
          )}
        />
      )}
      <FAB onPress={() => router.push('/page/new')} />

      <Modal visible={debugVisible} transparent animationType="fade" onRequestClose={() => setDebugVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDebugVisible(false)}>
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>Notifications</Text>
            <Text style={styles.debugText}>
              {count === null ? 'Counting…' : `${count} scheduled on this device`}
            </Text>
            <Pressable style={styles.debugButton} onPress={resync}>
              <Text style={styles.debugButtonText}>Resync now</Text>
            </Pressable>
            <Text style={styles.debugText}>Signed in as {userId}</Text>
            <Pressable style={[styles.debugButton, styles.signOutButton]} onPress={signOut}>
              <Text style={styles.debugButtonText}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.background },
  grid: { padding: 6, paddingBottom: 100 },
  gear: { fontSize: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: UI.textMuted, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  debugCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: 260, gap: 10 },
  debugTitle: { fontSize: 16, fontWeight: '600', color: UI.text },
  debugText: { color: UI.textMuted },
  debugButton: { backgroundColor: UI.accent, borderRadius: 8, padding: 10, alignItems: 'center' },
  debugButtonText: { color: '#fff', fontWeight: '600' },
  signOutButton: { backgroundColor: UI.danger },
});
