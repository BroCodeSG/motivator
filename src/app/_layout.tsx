import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { LoginScreen } from '@/components/LoginScreen';
import { addResponseListener, reconcileAll, setupNotifications } from '@/lib/notifications';
import { PagesProvider, usePages } from '@/lib/pages-context';
import { SessionProvider, useSession } from '@/lib/session-context';
import { UI } from '@/theme';

// Web: make the whole app use a clean sans-serif (Arial) instead of the
// platform default. !important beats react-native-web's inline font-family.
const _doc: any = (globalThis as any).document;
if (_doc && !_doc.getElementById('tbka-font')) {
  const st = _doc.createElement('style');
  st.id = 'tbka-font';
  st.textContent = `#root, #root * { font-family: ${UI.font} !important; }`;
  _doc.head.appendChild(st);
}

// Keeps the notification schedule in sync with the data: runs on cold start,
// on foreground, and on every Firestore snapshot (covers remote edits made
// via scripts/manage.mjs while the app is open).
function NotificationSync() {
  const { pages, ready } = usePages();
  const router = useRouter();
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    if (ready) reconcileAll(pages);
  }, [pages, ready]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reconcileAll(pagesRef.current);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return addResponseListener((pageId) => router.push(`/?open=${pageId}`));
  }, [router]);

  return null;
}

function Root() {
  const { userId, loading } = useSession();

  if (loading) return null;
  if (!userId) return <LoginScreen />;

  return (
    <PagesProvider userId={userId}>
      <NotificationSync />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: UI.background },
          headerTintColor: UI.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: UI.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'TBKA' }} />
        <Stack.Screen name="page/new" options={{ title: 'New page', presentation: 'modal' }} />
      </Stack>
    </PagesProvider>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  );
}
