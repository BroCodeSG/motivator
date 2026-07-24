import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { FAB } from '@/components/FAB';
import { PageCard } from '@/components/PageCard';
import { PageDetailCard } from '@/components/PageDetailCard';
import { Toggle } from '@/components/Toggle';
import { changePin, getRetentionMonths, getUserEmail, setRetentionMonths, setUserEmail } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { cancelAllNotifications, notificationsAvailable, reconcileAll, scheduledCount } from '@/lib/notifications';
import { createPage, deletePage } from '@/lib/pages';
import { usePages } from '@/lib/pages-context';
import { useSession } from '@/lib/session-context';
import { UI } from '@/theme';
import type { IntervalType, ReminderTime } from '@/types';

const WEEKDAYS: Record<string, number> = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

interface AddSpec {
  title?: string;
  type?: string;
  checklist?: boolean;
  body?: string;
  items?: string[];
  notify?: boolean;
  onceAt?: string | null;
  interval?: string;
  times?: ReminderTime[];
  color?: string;
}

function parseTimesSpec(interval: string, spec: string): ReminderTime[] {
  return spec
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      if (interval === 'daily') {
        const [h, m] = part.split(':').map(Number);
        return { hour: h, minute: m || 0 };
      }
      const [prefix, clock] = part.split('@');
      const [h, m] = (clock || '').split(':').map(Number);
      if (interval === 'weekly') return { weekday: WEEKDAYS[prefix.slice(0, 3).toLowerCase()] || 2, hour: h, minute: m || 0 };
      return { day: Number(prefix) || 1, hour: h, minute: m || 0 };
    });
}

// Turn the URL query into an AddSpec, or null if it's not an add-link.
function parseAddParams(p: Record<string, any>): AddSpec | null {
  if (p.add) {
    try {
      const b64 = String(p.add).replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '==='.slice((b64.length + 3) % 4);
      const bin = (globalThis as any).atob(padded);
      const bytes = Uint8Array.from(bin, (c: string) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }
  if (p.new === '1' || (p.title && p.new !== undefined)) {
    const interval = ['daily', 'weekly', 'monthly'].includes(p.interval) ? p.interval : 'daily';
    const at = p.at ? String(p.at).replace(' ', 'T') : null;
    return {
      title: p.title ?? '',
      type: p.type === 'reminderList' ? 'reminderList' : 'note',
      checklist: p.checklist === '1' || p.checklist === 'true',
      body: p.body ?? '',
      items: p.items ? String(p.items).split(';').map((x) => x.trim()).filter(Boolean) : [],
      notify: p.notify === '1' || p.notify === 'true' || !!p.at,
      onceAt: at,
      interval,
      times: p.times ? parseTimesSpec(interval, String(p.times)) : [],
      color: p.color,
    };
  }
  return null;
}

export default function HomeScreen() {
  const { pages, ready } = usePages();
  const { userId, logout } = useSession();
  const router = useRouter();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'note' | 'reminder' | 'recurring'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [pinDraft, setPinDraft] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [search, setSearch] = useState('');
  const [retentionDraft, setRetentionDraft] = useState('3');
  const params = useLocalSearchParams<Record<string, string>>();
  const { width } = useWindowDimensions();
  const numColumns = width >= 720 ? 3 : 2;
  const addApplied = useRef(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openEditing, setOpenEditing] = useState(false);
  const webBlur: any = Platform.OS === 'web' ? { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } : {};

  // Open a page from a deep link (?open=<id>, e.g. a notification tap).
  useEffect(() => {
    if (params.open) {
      setOpenId(String(params.open));
      setOpenEditing(false);
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open]);

  // "Tap to add" deep link — lets a networkless assistant (e.g. claude.ai) create
  // a page by handing the user a URL; the logged-in browser does the write.
  // Two forms:
  //   ?add=<base64url json spec>                        (built by create_note.py)
  //   ?new=1&title=..&type=..&items=a;b&at=..&...        (built by hand — no script)
  useEffect(() => {
    if (addApplied.current || !userId || !ready) return;
    const spec = parseAddParams(params);
    if (!spec) return;
    addApplied.current = true;
    try {
      const position = pages.reduce((m, p) => Math.max(m, p.position), 0) + 1;
      const isList = spec.type === 'reminderList';
      createPage({
        title: spec.title ?? '',
        type: isList ? 'reminderList' : 'note',
        color: spec.color ?? 'yellow',
        position,
        checklist: !isList ? !!spec.checklist : undefined,
        body: !isList && !spec.checklist ? spec.body ?? '' : undefined,
        notifyEnabled: !isList ? !!spec.notify : undefined,
        onceAt: !isList && spec.notify ? spec.onceAt ?? null : undefined,
        interval: isList ? ((spec.interval as IntervalType) ?? 'daily') : undefined,
        times: isList ? spec.times ?? [] : undefined,
        items: isList || spec.checklist ? (spec.items ?? []).map((t: string) => ({ text: t })) : undefined,
      }).catch(() => {});
    } catch {
      // ignore a malformed link
    }
    router.replace('/');
  }, [params, userId, ready, pages, router]);

  const allTags = [...new Set(pages.flatMap((p) => p.tags))].sort();
  const q = search.trim().toLowerCase();
  const matchesType = (p: (typeof pages)[number]) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'note') return p.type === 'note' && !p.notifyEnabled;
    if (typeFilter === 'reminder') return p.type === 'note' && p.notifyEnabled;
    return p.type === 'reminderList'; // 'recurring'
  };
  const visiblePages = pages
    .filter((p) => (showArchived ? true : !p.archived))
    .filter(matchesType)
    .filter((p) => (activeTag ? p.tags.includes(activeTag) : true))
    .filter((p) =>
      q ? (p.title || '').toLowerCase().includes(q) || p.tags.some((t) => t.includes(q)) : true
    );

  const TYPE_FILTERS: { key: typeof typeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'note', label: '📝 Notes' },
    { key: 'reminder', label: '🔔 Reminders' },
    { key: 'recurring', label: '🔁 Recurring' },
  ];

  const openSettings = async () => {
    setSettingsVisible(true);
    setStatusMsg('');
    setPinDraft('');
    setCount(await scheduledCount());
    if (userId) {
      setEmailDraft(await getUserEmail(userId));
      setRetentionDraft(String(await getRetentionMonths(userId)));
    }
  };

  const saveEmail = async () => {
    if (!userId) return;
    await setUserEmail(userId, emailDraft.trim());
    setStatusMsg('Email saved.');
  };

  const saveRetention = async () => {
    if (!userId) return;
    const n = parseInt(retentionDraft, 10);
    if (!(n >= 1)) {
      setStatusMsg('Enter a number of months (1 or more).');
      return;
    }
    await setRetentionMonths(userId, n);
    setStatusMsg(`Archived pages delete after ${n} month(s).`);
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
      {pages.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.tagBar}
        >
          {TYPE_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.tagChip, typeFilter === f.key && styles.tagChipActive]}
              onPress={() => setTypeFilter(f.key)}
            >
              <Text numberOfLines={1} style={[styles.tagText, typeFilter === f.key && styles.tagTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.tagBar}
        >
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
          numColumns={numColumns}
          key={`cols-${numColumns}`}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <PageCard
              page={item}
              onPress={() => {
                setOpenEditing(false);
                setOpenId(item.id);
              }}
              onLongPress={() => confirmDelete(item.id, item.title)}
              onEdit={() => {
                setOpenEditing(true);
                setOpenId(item.id);
              }}
              onDelete={() => confirmDelete(item.id, item.title)}
            />
          )}
        />
      )}
      <FAB onPress={() => router.push('/page/new')} />

      {openId && (
        <View style={[styles.overlay, webBlur]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenId(null)} />
          <PageDetailCard id={openId} initialEditing={openEditing} onClose={() => setOpenId(null)} />
        </View>
      )}

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
              <Text style={styles.label}>Delete archived after (months)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={retentionDraft}
                onChangeText={setRetentionDraft}
              />
              <Pressable style={styles.button} onPress={saveRetention}>
                <Text style={styles.buttonText}>Save</Text>
              </Pressable>

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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 50,
  },
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
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  tagBar: { paddingHorizontal: 12, paddingVertical: 5, gap: 8 },
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
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingRight: 12 },
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
