import { beforeEach, describe, expect, it, vi } from "vitest";

const { update } = vi.hoisted(() => ({
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { update },
  },
}));

import { recordSuccessfulLogin } from "@/lib/services/auth/record-successful-login";

describe("recordSuccessfulLogin", () => {
  beforeEach(() => {
    update.mockReset();
  });

  it("met à jour lastLogin + loginCount", async () => {
    update.mockResolvedValue({});
    await recordSuccessfulLogin("user-1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        lastLogin: expect.any(Date),
        loginCount: { increment: 1 },
      },
    });
  });

  it("refuse userId vide", async () => {
    await expect(recordSuccessfulLogin("")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
