import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import {
  registerPushTokenApi,
  unregisterPushTokenApi,
} from "@/api/push-tokens";

/**
 * Channel Android V2 — nouvel id obligatoire.
 * Android ne permet pas de relever l'importance d'un channel déjà créé ("amaki" = DEFAULT).
 *
 * Limite connue V1 (Samsung A54 / One UI) : heads-up parfois absent malgré
 * importance HIGH + popup autorisée + notification reçue dans le volet.
 * Ne bloque pas la release V1 — à revoir côté OEM / app importance.
 */
export const AMAKI_ANDROID_CHANNEL_ID = "amaki_alerts";

let lastRegisteredToken: string | null = null;
let permissionPromptedThisSession = false;
/** Une seule création channel par session (évite double log / double set). */
let channelEnsurePromise: Promise<void> | null = null;
let channelEnsureDone = false;
let channelDevRecreated = false;

type ExpoNotificationsModule = typeof import("expo-notifications");

function pushBootLog(message: string, detail?: Record<string, unknown>): void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  if (detail) {
    console.log(`[PUSH_BOOT] ${message}`, detail);
  } else {
    console.log(`[PUSH_BOOT] ${message}`);
  }
}

/**
 * Charge expo-notifications uniquement si le module natif est présent.
 * Évite le crash Metro sur un ancien development build.
 */
export async function loadExpoNotifications(): Promise<ExpoNotificationsModule | null> {
  try {
    const Notifications = await import("expo-notifications");
    // Touch API légère pour forcer la résolution native
    await Notifications.getPermissionsAsync();
    return Notifications;
  } catch (error) {
    pushBootLog("loadExpoNotifications failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

/**
 * ProjectId EAS réel uniquement (jamais hardcodé).
 */
export function getExpoProjectId(): string | null {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }
  const fromEas = Constants.easConfig?.projectId;
  if (typeof fromEas === "string" && fromEas.trim()) {
    return fromEas.trim();
  }
  return null;
}

/**
 * Channel Android unique V2 (HIGH) pour bannières visibles.
 * Pas de `sound: "default"` : Expo 57 le traite comme son custom introuvable.
 * Son système éventuel = payload Expo Push uniquement.
 * Idempotent : un seul set réel par session.
 */
export async function ensureAmakiAndroidChannel(
  Notifications?: ExpoNotificationsModule | null
): Promise<void> {
  if (Platform.OS !== "android") return;
  if (channelEnsureDone) return;
  if (channelEnsurePromise) {
    await channelEnsurePromise;
    return;
  }

  channelEnsurePromise = (async () => {
    const mod = Notifications ?? (await loadExpoNotifications());
    if (!mod) return;

    // DEV : recréer une fois si un channel partiel (sound invalide) existait
    if (
      typeof __DEV__ !== "undefined" &&
      __DEV__ &&
      !channelDevRecreated &&
      typeof mod.deleteNotificationChannelAsync === "function"
    ) {
      try {
        await mod.deleteNotificationChannelAsync(AMAKI_ANDROID_CHANNEL_ID);
        channelDevRecreated = true;
        pushBootLog("channel amaki_alerts supprimé (DEV) pour recreation propre");
      } catch {
        channelDevRecreated = true;
      }
    }

    await mod.setNotificationChannelAsync(AMAKI_ANDROID_CHANNEL_ID, {
      name: "AMAKI",
      importance: mod.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#208AEF",
      enableVibrate: true,
      showBadge: true,
    });
    channelEnsureDone = true;
    pushBootLog("channel amaki_alerts prêt", {
      importance: "HIGH",
      soundProperty: "omitted",
    });
  })();

  try {
    await channelEnsurePromise;
  } finally {
    channelEnsurePromise = null;
  }
}

export type PushPermissionState = "granted" | "denied" | "undetermined";

function mapPermissionStatus(input: {
  granted: boolean;
  status: string;
}): PushPermissionState {
  if (input.granted || input.status === "granted") return "granted";
  if (input.status === "denied") return "denied";
  return "undetermined";
}

/**
 * Demande la permission push (sans spam si déjà refusée / déjà demandée).
 */
export async function requestPushPermission(): Promise<PushPermissionState> {
  if (!Device.isDevice) {
    pushBootLog("requestPushPermission skipped", { reason: "not_device" });
    return "denied";
  }

  const Notifications = await loadExpoNotifications();
  if (!Notifications) {
    pushBootLog("requestPushPermission skipped", { reason: "native_missing" });
    return "denied";
  }

  // Android 13+ : channel requis avant la demande système
  await ensureAmakiAndroidChannel(Notifications);

  const current = await Notifications.getPermissionsAsync();
  const before = mapPermissionStatus(current);
  const shouldRequestPermission =
    before === "undetermined" && !permissionPromptedThisSession;

  pushBootLog("permission.status avant demande", {
    status: current.status,
    granted: current.granted,
    mapped: before,
    shouldRequestPermission,
  });

  if (before === "granted") return "granted";
  if (before === "denied") return "denied";

  if (!shouldRequestPermission) {
    pushBootLog("permission: pas de requestPermissionsAsync", {
      reason: permissionPromptedThisSession
        ? "already_prompted_this_session"
        : "not_undetermined",
    });
    return before;
  }

  permissionPromptedThisSession = true;
  pushBootLog("requestPermissionsAsync() appelé");
  const requested = await Notifications.requestPermissionsAsync();
  const after = mapPermissionStatus(requested);
  pushBootLog("permission.status après demande", {
    status: requested.status,
    granted: requested.granted,
    mapped: after,
  });
  return after;
}

/**
 * Récupère le token Expo Push (appareil physique + projectId requis).
 */
export async function getCurrentExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const projectId = getExpoProjectId();
  pushBootLog("getExpoPushTokenAsync projectId", {
    present: Boolean(projectId),
  });
  if (!projectId) {
    return null;
  }

  const Notifications = await loadExpoNotifications();
  if (!Notifications) return null;

  await ensureAmakiAndroidChannel(Notifications);

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    const obtained = Boolean(result.data?.trim());
    pushBootLog("token obtenu ?", { obtained });
    return result.data?.trim() || null;
  } catch (error) {
    pushBootLog("getExpoPushTokenAsync erreur", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage:
        error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return null;
  }
}

/**
 * Permission + token + register backend. No-op sûr si indisponible.
 */
export async function registerCurrentPushToken(): Promise<{
  registered: boolean;
  reason?: string;
}> {
  pushBootLog("registerCurrentPushToken start", {
    isDevice: Device.isDevice,
    projectIdPresent: Boolean(getExpoProjectId()),
    platform: Platform.OS,
  });

  if (!Device.isDevice) {
    pushBootLog("register abort", { reason: "not_physical_device" });
    return { registered: false, reason: "not_physical_device" };
  }

  const permission = await requestPushPermission();
  if (permission !== "granted") {
    pushBootLog("register abort", { reason: `permission_${permission}` });
    return { registered: false, reason: `permission_${permission}` };
  }

  const token = await getCurrentExpoPushToken();
  if (!token) {
    pushBootLog("register abort", { reason: "no_token" });
    return { registered: false, reason: "no_token" };
  }

  if (lastRegisteredToken === token) {
    pushBootLog("register API appelé ?", {
      called: false,
      reason: "already_registered",
    });
    return { registered: true, reason: "already_registered" };
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";
  pushBootLog("register API appelé ?", { called: true });
  try {
    await registerPushTokenApi({
      token,
      platform,
      deviceName: Device.modelName ?? null,
    });
    lastRegisteredToken = token;
    pushBootLog("register API status", { ok: true });
    return { registered: true };
  } catch (error) {
    pushBootLog("register API status", {
      ok: false,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage:
        error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return { registered: false, reason: "api_error" };
  }
}

/**
 * Détache le token courant côté backend. Ne bloque jamais le logout.
 */
export async function unregisterCurrentPushToken(): Promise<void> {
  try {
    const token =
      lastRegisteredToken || (await getCurrentExpoPushToken().catch(() => null));
    if (!token) {
      lastRegisteredToken = null;
      return;
    }
    await unregisterPushTokenApi(token);
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[push] unregister on logout failed", error);
    }
  } finally {
    lastRegisteredToken = null;
  }
}

/**
 * Reset état session (tests / logout).
 */
export function resetPushSessionStateForTests(): void {
  lastRegisteredToken = null;
  permissionPromptedThisSession = false;
  channelEnsurePromise = null;
  channelEnsureDone = false;
  channelDevRecreated = false;
}

export function getLastRegisteredPushTokenForTests(): string | null {
  return lastRegisteredToken;
}

export function setLastRegisteredPushTokenForTests(token: string | null): void {
  lastRegisteredToken = token;
}
