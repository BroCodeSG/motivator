import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const USER_KEY = 'current-user-id';

interface Session {
  userId: string | null;
  loading: boolean;
  login: (id: string) => void;
  logout: () => void;
}

const SessionContext = createContext<Session>({
  userId: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(USER_KEY)
      .then((id) => setUserId(id))
      .finally(() => setLoading(false));
  }, []);

  const login = (id: string) => {
    setUserId(id);
    AsyncStorage.setItem(USER_KEY, id).catch(() => {});
  };

  const logout = () => {
    setUserId(null);
    AsyncStorage.removeItem(USER_KEY).catch(() => {});
  };

  return (
    <SessionContext.Provider value={{ userId, loading, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  return useContext(SessionContext);
}
