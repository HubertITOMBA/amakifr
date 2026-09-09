import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const resolveApiActor = vi.fn();
const registerMyPushToken = vi.fn();
const removeMyPushToken = vi.fn();

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: (...args: unknown[]) => resolveApiActor(...args),
}));
vi.mock("@/lib/services/push/register-my-push-token", () => ({
  registerMyPushToken: (...args: unknown[]) => registerMyPushToken(...args),
}));
vi.mock("@/lib/services/push/remove-my-push-token", () => ({
  removeMyPushToken: (...args: unknown[]) => removeMyPushToken(...args),
}));

import { DELETE, POST } from "@/app/api/v1/me/push-tokens/route";

function req(method: string, body?: unknown, qs = "") {
  return new NextRequest(`http://localhost/api/v1/me/push-tokens${qs}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("push-tokens routes", () => {
  beforeEach(() => {
    resolveApiActor.mockReset();
    registerMyPushToken.mockReset();
    removeMyPushToken.mockReset();
    resolveApiActor.mockResolvedValue({ userId: "u1" });
  });

  it("POST register", async () => {
    registerMyPushToken.mockResolvedValue({
      id: "1",
      token: "ExponentPushToken[x]",
      platform: "android",
      lastSeenAt: "2026-09-08T00:00:00.000Z",
    });
    const res = await POST(
      req("POST", {
        token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]",
        platform: "android",
      })
    );
    expect(res.status).toBe(200);
  });

  it("POST refuse userId body", async () => {
    const res = await POST(
      req("POST", {
        token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]",
        platform: "android",
        userId: "other",
      })
    );
    expect(res.status).toBe(400);
    expect(registerMyPushToken).not.toHaveBeenCalled();
  });

  it("DELETE self", async () => {
    removeMyPushToken.mockResolvedValue({ removed: true });
    const res = await DELETE(
      req("DELETE", { token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]" })
    );
    expect(res.status).toBe(200);
  });

  it("refuse query userId", async () => {
    const res = await POST(
      req(
        "POST",
        {
          token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]",
          platform: "android",
        },
        "?userId=x"
      )
    );
    expect(res.status).toBe(400);
  });

  it("401", async () => {
    resolveApiActor.mockResolvedValue(null);
    const res = await POST(req("POST", { token: "x", platform: "android" }));
    expect(res.status).toBe(401);
  });
});
