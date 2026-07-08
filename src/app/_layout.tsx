import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { LoginScreen } from '@/components/LoginScreen';
import { addResponseListener, reconcileAll, setupNotifications } from '@/lib/notifications';
import { PagesProvider, usePages } from '@/lib/pages-context';
import { SessionProvider, useSession } from '@/lib/session-context';
import { UI } from '@/theme';

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
    return addResponseListener((pageId) => router.push(`/page/${pageId}`));
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
        <Stack.Screen name="index" options={{ title: 'Motivator' }} />
        <Stack.Screen name="page/new" options={{ title: 'New page', presentation: 'modal' }} />
        <Stack.Screen name="page/[id]" options={{ title: '' }} />
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
