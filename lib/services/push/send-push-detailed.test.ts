import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  classifyExpoTicketError,
  sendPushToUsersDetailed,
} from "@/lib/services/push/send-push";
import type { ExpoPushHttpClient } from "@/lib/services/push/types";

const findMany = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    mobilePushToken: {
      findMany: (...args: unknown[]) => findMany(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}));

describe("sendPushToUsersDetailed", () => {
  beforeEach(() => {
    findMany.mockReset();
    updateMany.mockReset();
    updateMany.mockResolvedValue({ count: 0 });
  });

  it("no_tokens sans déduire d'un compteur d'erreurs", async () => {
    findMany.mockResolvedValue([]);
    const res = await sendPushToUsersDetailed(["u1"], {
      title: "t",
      body: "b",
    });
    expect(res.summary).toBe("no_tokens");
    expect(res.details).toEqual([]);
  });

  it("classe DeviceNotRegistered comme définitif au niveau détail", async () => {
    findMany.mockResolvedValue([{ token: "ExponentPushToken[abc]", platform: "android" }]);
    const client: ExpoPushHttpClient = {
      send: async () => [
        {
          status: "error",
          message: "gone",
          details: { error: "DeviceNotRegistered" },
        },
      ],
    };
    const res = await sendPushToUsersDetailed(
      ["u1"],
      { title: "t", body: "b" },
      client
    );
    expect(res.summary).toBe("all_failed_definitive");
    expect(res.details[0]).toMatchObject({
      kind: "ticket_error",
      errorClass: "definitive",
      code: "DeviceNotRegistered",
    });
    expect(classifyExpoTicketError("DeviceNotRegistered")).toBe("definitive");
  });

  it("transport batch → temporary / transport_failed", async () => {
    findMany.mockResolvedValue([{ token: "ExponentPushToken[xyz]", platform: "ios" }]);
    const client: ExpoPushHttpClient = {
      send: async () => {
        throw new Error("HTTP 503");
      },
    };
    const res = await sendPushToUsersDetailed(
      ["u1"],
      { title: "t", body: "b" },
      client
    );
    expect(res.summary).toBe("transport_failed");
    expect(res.details[0]?.kind).toBe("batch_transport_error");
  });
});
