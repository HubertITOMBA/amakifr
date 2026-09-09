import { describe, expect, it } from "vitest";
import {
  chatPushListenerCountForTests,
  isChatPushData,
  notifyChatPushReceived,
  resetChatPushListenersForTests,
  subscribeChatPushRefresh,
} from "@/api/push-events";

describe("push-events", () => {
  it("détecte url Chat", () => {
    expect(isChatPushData({ url: "/chat/abc" })).toBe(true);
    expect(isChatPushData({ url: "/paiement" })).toBe(false);
    expect(isChatPushData(null)).toBe(false);
  });

  it("notify appelle les abonnés", () => {
    resetChatPushListenersForTests();
    let n = 0;
    const unsub = subscribeChatPushRefresh(() => {
      n += 1;
    });
    expect(chatPushListenerCountForTests()).toBe(1);
    notifyChatPushReceived();
    expect(n).toBe(1);
    unsub();
    notifyChatPushReceived();
    expect(n).toBe(1);
  });
});
