import { beforeEach, describe, expect, it, vi } from "vitest";

const getPermissionsAsync = vi.fn();
const requestPermissionsAsync = vi.fn();
const getExpoPushTokenAsync = vi.fn();
const setNotificationChannelAsync = vi.fn();
const registerPushTokenApi = vi.fn();
const unregisterPushTokenApi = vi.fn();

vi.mock("expo-device", () => ({
  isDevice: true,
  modelName: "SM-A546B",
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: { eas: { projectId: "proj-test" } } },
    easConfig: null,
  },
}));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: (...a: unknown[]) => getPermissionsAsync(...a),
  requestPermissionsAsync: (...a: unknown[]) => requestPermissionsAsync(...a),
  getExpoPushTokenAsync: (...a: unknown[]) => getExpoPushTokenAsync(...a),
  setNotificationChannelAsync: (...a: unknown[]) =>
    setNotificationChannelAsync(...a),
  deleteNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));

vi.mock("@/api/push-tokens", () => ({
  registerPushTokenApi: (...a: unknown[]) => registerPushTokenApi(...a),
  unregisterPushTokenApi: (...a: unknown[]) => unregisterPushTokenApi(...a),
}));

import {
  AMAKI_ANDROID_CHANNEL_ID,
  getExpoProjectId,
  registerCurrentPushToken,
  requestPushPermission,
  resetPushSessionStateForTests,
  setLastRegisteredPushTokenForTests,
  unregisterCurrentPushToken,
} from "@/api/push-notifications";

describe("push-notifications helpers", () => {
  beforeEach(() => {
    resetPushSessionStateForTests();
    getPermissionsAsync.mockReset();
    requestPermissionsAsync.mockReset();
    getExpoPushTokenAsync.mockReset();
    setNotificationChannelAsync.mockReset();
    registerPushTokenApi.mockReset();
    unregisterPushTokenApi.mockReset();
    getPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
    });
  });

  it("channel Android V2 = amaki_alerts", () => {
    expect(AMAKI_ANDROID_CHANNEL_ID).toBe("amaki_alerts");
  });

  it("projectId depuis config", () => {
    expect(getExpoProjectId()).toBe("proj-test");
  });

  it("permission denied → no-op register", async () => {
    getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: "denied",
    });
    const r = await registerCurrentPushToken();
    expect(r.registered).toBe(false);
    expect(registerPushTokenApi).not.toHaveBeenCalled();
  });

  it("permission granted → register API", async () => {
    getPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
    });
    getExpoPushTokenAsync.mockResolvedValue({
      data: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]",
    });
    registerPushTokenApi.mockResolvedValue({ id: "1" });
    const r = await registerCurrentPushToken();
    expect(r.registered).toBe(true);
    expect(registerPushTokenApi).toHaveBeenCalled();
  });

  it("requestPushPermission undetermined → demande", async () => {
    getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: "undetermined",
    });
    requestPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
    });
    await expect(requestPushPermission()).resolves.toBe("granted");
  });

  it("unregister continue si API échoue", async () => {
    setLastRegisteredPushTokenForTests(
      "ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]"
    );
    unregisterPushTokenApi.mockRejectedValue(new Error("network"));
    await expect(unregisterCurrentPushToken()).resolves.toBeUndefined();
  });
});
