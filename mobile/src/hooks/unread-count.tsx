import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getUnreadNotificationCount } from "@/api/notifications";

type UnreadCountContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
};

const UnreadCountContext = createContext<UnreadCountContextValue | null>(null);

/**
 * Compteur non lu partagé (tab badge + Accueil).
 * Un seul GET /unread-count ; hors AuthProvider.
 */
export function UnreadCountProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // Ne pas casser la navigation si le compteur échoue.
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount }),
    [unreadCount, refreshUnreadCount]
  );

  return (
    <UnreadCountContext.Provider value={value}>
      {children}
    </UnreadCountContext.Provider>
  );
}

/**
 * Accès au compteur non lu (sous UnreadCountProvider).
 */
export function useUnreadCount(): UnreadCountContextValue {
  const ctx = useContext(UnreadCountContext);
  if (!ctx) {
    throw new Error("useUnreadCount doit être utilisé dans UnreadCountProvider");
  }
  return ctx;
}
