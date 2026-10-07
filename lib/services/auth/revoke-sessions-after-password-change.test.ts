import { beforeEach, describe, expect, it, vi } from "vitest";

const { revokeRedis } = vi.hoisted(() => ({
  revokeRedis: vi.fn(),
}));

vi.mock("@/lib/session-tracker", () => ({
  revokeAllUserSessions: revokeRedis,
}));

import { revokeRedisSessionsBestEffort } from "@/lib/services/auth/revoke-sessions-after-password-change";

describe("revokeRedisSessionsBestEffort", () => {
  beforeEach(() => {
    revokeRedis.mockReset();
  });

  it("appelle le tracker Redis sans throw", async () => {
    revokeRedis.mockResolvedValue(1);
    await revokeRedisSessionsBestEffort("u1");
    expect(revokeRedis).toHaveBeenCalledWith("u1");
  });

  it("avale les erreurs Redis", async () => {
    revokeRedis.mockRejectedValue(new Error("redis down"));
    await expect(revokeRedisSessionsBestEffort("u1")).resolves.toBeUndefined();
  });
});
