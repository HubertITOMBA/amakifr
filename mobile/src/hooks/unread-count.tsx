import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getUnreadNotificationCount } from "@/api/notifications";
import { shouldRefreshUnreadOnAppState } from "@/api/notifications-state";

type UnreadCountContextValue = {
  unreadCount: number;
  /** Refresh réseau (dédupliqué, conserve la dernière valeur si erreur). */
  refreshUnreadCount: () => Promise<void>;
  /** Mise à jour locale immédiate (lecture / suppression / mark all). */
  setUnreadCountLocal: (next: number | ((prev: number) => number)) => void;
  /** Reset explicite (logout / changement user). */
  resetUnreadCount: () => void;
};

const UnreadCountContext = createContext<UnreadCountContextValue | null>(null);

/**
 * Compteur non lu partagé (tab badge + Accueil).
 * Source : GET /api/v1/me/notifications/unread-count uniquement.
 * Refresh : montage (login/session), AppState foreground, callers focus.
 */
export function UnreadCountProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const requestSeq = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshUnreadCount = useCallback(async () => {
    if (inFlight.current) {
      return inFlight.current;
    }

    const seq = ++requestSeq.current;
    const run = (async () => {
      try {
        const count = await getUnreadNotificationCount();
        if (seq !== requestSeq.current) return;
        setUnreadCount(Math.max(0, count));
      } catch {
        // Conserve la dernière valeur connue — pas de toast.
      } finally {
        if (seq === requestSeq.current) {
          inFlight.current = null;
        }
      }
    })();

    inFlight.current = run;
    return run;
  }, []);

  const setUnreadCountLocal = useCallback(
    (next: number | ((prev: number) => number)) => {
      setUnreadCount((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        return Math.max(0, value);
      });
    },
    []
  );

  const resetUnreadCount = useCallback(() => {
    requestSeq.current += 1;
    inFlight.current = null;
    setUnreadCount(0);
  }, []);

  // Login / session restore : provider monté uniquement dans (app) authentifié
  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  // Foreground : background/inactive → active
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (shouldRefreshUnreadOnAppState(prev, next)) {
        void refreshUnreadCount();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [refreshUnreadCount]);

  // Cleanup logout : unmount reset implicite ; reset explicite pour sécurité
  useEffect(() => {
    return () => {
      requestSeq.current += 1;
      inFlight.current = null;
    };
  }, []);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      setUnreadCountLocal,
      resetUnreadCount,
    }),
    [unreadCount, refreshUnreadCount, setUnreadCountLocal, resetUnreadCount]
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
