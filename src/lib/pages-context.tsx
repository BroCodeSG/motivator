import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getRetentionMonths } from '@/lib/auth';
import { deleteExpiredArchived, loadCachedPages, setActiveUser, subscribePages } from '@/lib/pages';
import type { Page } from '@/types';

interface PagesState {
  pages: Page[];
  ready: boolean;
}

const PagesContext = createContext<PagesState>({ pages: [], ready: false });

export function PagesProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<PagesState>({ pages: [], ready: false });
  const hadSnapshot = useRef(false);
  const cleaned = useRef(false);

  useEffect(() => {
    let live = true;
    hadSnapshot.current = false;
    cleaned.current = false;
    setState({ pages: [], ready: false });
    setActiveUser(userId);
    loadCachedPages().then((cached) => {
      if (live && !hadSnapshot.current && cached.length > 0) {
        setState({ pages: cached, ready: true });
      }
    });
    const unsub = subscribePages((pages) => {
      if (!live) return;
      hadSnapshot.current = true;
      setState({ pages, ready: true });
      // Once per session: purge archived pages past the retention window.
      if (!cleaned.current) {
        cleaned.current = true;
        getRetentionMonths(userId)
          .then((m) => deleteExpiredArchived(pages, m))
          .catch(() => {});
      }
    });
    return () => {
      live = false;
      unsub();
    };
  }, [userId]);

  return <PagesContext.Provider value={state}>{children}</PagesContext.Provider>;
}

export function usePages(): PagesState {
  return useContext(PagesContext);
}

export function usePage(id: string | undefined): Page | undefined {
  const { pages } = usePages();
  return pages.find((p) => p.id === id);
}
