import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { router, type Href } from "expo-router";
import * as Device from "expo-device";
import { notificationLinkToMobileRoute } from "@/api/notification-link";
import {
  isChatPushData,
  notifyChatPushReceived,
} from "@/api/push-events";
import {
  getExpoProjectId,
  loadExpoNotifications,
  registerCurrentPushToken,
} from "@/api/push-notifications";
import { useUnreadCount } from "@/hooks/unread-count";

type Props = {
  children: React.ReactNode;
};

function pushBootLog(message: string, detail?: Record<string, unknown>): void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  if (detail) {
    console.log(`[PUSH_BOOT] ${message}`, detail);
  } else {
    console.log(`[PUSH_BOOT] ${message}`);
  }
}

/**
 * Enregistrement token push + listeners tap / foreground (zone authentifiée).
 * Import natif différé : un ancien binaire sans ExpoPushTokenManager ne crash plus.
 */
export function PushNotificationsBootstrap({ children }: Props) {
  const { refreshUnreadCount } = useUnreadCount();
  const registeredRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    pushBootLog("mounted", {
      isDevice: Device.isDevice,
      projectIdPresent: Boolean(getExpoProjectId()),
    });

    if (registeredRef.current) {
      pushBootLog("register skip — déjà lancé cette session");
      return;
    }
    registeredRef.current = true;
    void registerCurrentPushToken().then((result) => {
      pushBootLog("registerCurrentPushToken done", {
        registered: result.registered,
        reason: result.reason ?? null,
      });
    });
  }, []);

  useEffect(() => {
    let receivedSub: { remove: () => void } | undefined;
    let responseSub: { remove: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const Notifications = await loadExpoNotifications();
      if (!Notifications || cancelled) {
        pushBootLog("listeners skip", {
          reason: !Notifications ? "native_missing" : "cancelled",
        });
        return;
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          // V1 : pas de son custom — priorité bannière / liste / badge
          shouldPlaySound: false,
          shouldSetBadge: true,
        }),
      });

      receivedSub = Notifications.addNotificationReceivedListener(
        (notification) => {
          void refreshUnreadCount();
          const data = notification.request.content.data;
          if (isChatPushData(data)) {
            notifyChatPushReceived();
          }
        }
      );

      responseSub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as
            | { url?: string }
            | undefined;
          const route = notificationLinkToMobileRoute(data?.url ?? null);
          if (route) {
            try {
              router.push(route as Href);
            } catch {
              // ignore navigation race
            }
          }
          void refreshUnreadCount();
          if (isChatPushData(data)) {
            notifyChatPushReceived();
          }
        }
      );
      pushBootLog("listeners attached");
    })();

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, [refreshUnreadCount]);

  // Retour foreground : compteurs + listes Chat actives (sans polling)
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (
        (prev === "background" || prev === "inactive") &&
        next === "active"
      ) {
        void refreshUnreadCount();
        notifyChatPushReceived();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [refreshUnreadCount]);

  return <>{children}</>;
}
