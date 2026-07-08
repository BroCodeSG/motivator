import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { LoginScreen } from '@/components/LoginScreen';
import { reconcileAll, setupNotifications } from '@/lib/notifications';
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
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const pageId = resp.notification.request.content.data?.pageId;
      if (typeof pageId === 'string') router.push(`/page/${pageId}`);
    });
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      const pageId = resp?.notification.request.content.data?.pageId;
      if (typeof pageId === 'string') router.push(`/page/${pageId}`);
    });
    return () => sub.remove();
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
