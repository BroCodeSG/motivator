import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FAB } from '@/components/FAB';
import { PageCard } from '@/components/PageCard';
import { Toggle } from '@/components/Toggle';
import { changePin, getUserEmail, setUserEmail } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { cancelAllNotifications, notificationsAvailable, reconcileAll, scheduledCount } from '@/lib/notifications';
import { deletePage } from '@/lib/pages';
import { usePages } from '@/lib/pages-context';
import { useSession } from '@/lib/session-context';
import { UI } from '@/theme';

export default function HomeScreen() {
  const { pages, ready } = usePages();
  const { userId, logout } = useSession();
  const router = useRouter();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [pinDraft, setPinDraft] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [search, setSearch] = useState('');

  const allTags = [...new Set(pages.flatMap((p) => p.tags))].sort();
  const q = search.trim().toLowerCase();
  const visiblePages = pages
    .filter((p) => (showArchived ? true : !p.archived))
    .filter((p) => (activeTag ? p.tags.includes(activeTag) : true))
    .filter((p) =>
      q ? (p.title || '').toLowerCase().includes(q) || p.tags.some((t) => t.includes(q)) : true
    );

  const openSettings = async () => {
    setSettingsVisible(true);
    setStatusMsg('');
    setPinDraft('');
    setCount(await scheduledCount());
    if (userId) setEmailDraft(await getUserEmail(userId));
  };

  const saveEmail = async () => {
    if (!userId) return;
    await setUserEmail(userId, emailDraft.trim());
    setStatusMsg('Email saved.');
  };

  const savePin = async () => {
    if (!userId) return;
    if (!/^\d{4,}$/.test(pinDraft)) {
      setStatusMsg('PIN must be at least 4 digits.');
      return;
    }
    await changePin(userId, pinDraft);
    setPinDraft('');
    setStatusMsg('PIN updated.');
  };

  const resync = async () => {
    await reconcileAll(pages);
    setCount(await scheduledCount());
  };

  const signOut = () => {
    confirmAction('Sign out', 'Reminders stop until you sign in again. Your data stays saved.', 'Sign out', async () => {
      setSettingsVisible(false);
      await cancelAllNotifications();
      logout();
    });
  };

  const confirmDelete = (pageId: string, title: string) => {
    confirmAction('Delete page', `Delete "${title || 'Untitled'}" and all its items?`, 'Delete', () =>
      deletePage(pageId)
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => router.push('/page/new')} hitSlop={10}>
                <Text style={styles.headerAdd}>＋</Text>
              </Pressable>
              <Pressable onPress={openSettings} hitSlop={10}>
                <Text style={styles.gear}>⚙️</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {pages.length > 0 && (
        <TextInput
          style={styles.search}
          placeholder="Search notes or #tags"
          placeholderTextColor={UI.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      )}
      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagBar}>
          <Pressable style={[styles.tagChip, activeTag === null && styles.tagChipActive]} onPress={() => setActiveTag(null)}>
            <Text numberOfLines={1} style={[styles.tagText, activeTag === null && styles.tagTextActive]}>All</Text>
          </Pressable>
          {allTags.map((tag) => (
            <Pressable
              key={tag}
              style={[styles.tagChip, activeTag === tag && styles.tagChipActive]}
              onPress={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              <Text numberOfLines={1} style={[styles.tagText, activeTag === tag && styles.tagTextActive]}>#{tag}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {visiblePages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {!ready
              ? 'Loading…'
              : q
                ? `No pages match "${search.trim()}".`
                : activeTag
                  ? `No pages tagged #${activeTag}.`
                  : 'No pages yet.\nTap ＋ to create your first one.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visiblePages}
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

      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSettingsVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>Settings</Text>
              <Text style={styles.muted}>Signed in as {userId}</Text>

              <Text style={styles.label}>Email for reminders</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={UI.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={emailDraft}
                onChangeText={setEmailDraft}
              />
              <Pressable style={styles.button} onPress={saveEmail}>
                <Text style={styles.buttonText}>Save email</Text>
              </Pressable>

              <Text style={styles.label}>Change PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="New PIN"
                placeholderTextColor={UI.textMuted}
                keyboardType="number-pad"
                secureTextEntry
                value={pinDraft}
                onChangeText={setPinDraft}
              />
              <Pressable style={styles.button} onPress={savePin}>
                <Text style={styles.buttonText}>Update PIN</Text>
              </Pressable>

              <View style={styles.divider} />
              <Toggle label="Show archived pages" value={showArchived} onChange={setShowArchived} />

              <View style={styles.divider} />
              <Text style={styles.muted}>
                {!notificationsAvailable
                  ? 'Reminders fire in the installed Android app'
                  : count === null
                    ? 'Counting…'
                    : `${count} notifications scheduled`}
              </Text>
              <Pressable style={styles.button} onPress={resync}>
                <Text style={styles.buttonText}>Resync notifications</Text>
              </Pressable>

              {statusMsg !== '' && <Text style={styles.status}>{statusMsg}</Text>}

              <Pressable style={[styles.button, styles.signOut]} onPress={signOut}>
                <Text style={styles.buttonText}>Sign out</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.background },
  grid: { padding: 6, paddingBottom: 100 },
  search: {
    margin: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: UI.text,
    fontSize: 15,
    backgroundColor: UI.surface,
  },
  tagBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  tagChip: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagChipActive: { backgroundColor: UI.accent, borderColor: UI.accent },
  tagText: { color: UI.textMuted, fontSize: 13 },
  tagTextActive: { color: UI.onAccent, fontWeight: '600' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  headerAdd: { fontSize: 24, color: UI.accent, lineHeight: 26 },
  gear: { fontSize: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: UI.textMuted, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: UI.surface, borderRadius: 14, width: 300, maxHeight: '85%' },
  sheetContent: { padding: 20, gap: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: UI.text },
  muted: { color: UI.textMuted, fontSize: 13 },
  label: { color: UI.textMuted, fontSize: 13, marginTop: 10 },
  input: { borderWidth: 1, borderColor: UI.border, borderRadius: 8, padding: 10, color: UI.text, fontSize: 15 },
  button: { backgroundColor: UI.accent, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 4 },
  buttonText: { color: UI.onAccent, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: UI.border, marginVertical: 8 },
  status: { color: UI.accent, fontSize: 13, textAlign: 'center', marginTop: 4 },
  signOut: { backgroundColor: UI.danger, marginTop: 12 },
});
