import { beforeEach, describe, expect, it, vi } from "vitest";
import { TypeNotification } from "@prisma/client";

const {
  create,
  createMany,
  findMany,
  pushAfterInternalNotification,
  pushAfterInternalNotifications,
  auth,
  revalidatePath,
} = vi.hoisted(() => ({
  create: vi.fn(),
  createMany: vi.fn(),
  findMany: vi.fn(),
  pushAfterInternalNotification: vi.fn(),
  pushAfterInternalNotifications: vi.fn(),
  auth: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notification: { create, createMany },
    user: { findMany },
  },
}));

vi.mock("@/auth", () => ({ auth }));

vi.mock("next/cache", () => ({ revalidatePath }));

vi.mock("@/lib/services/notifications/push-after-internal-notification", () => ({
  pushAfterInternalNotification,
  pushAfterInternalNotifications,
}));

import {
  createNotification,
  createNotifications,
} from "@/actions/notifications/index";

describe("createNotification + push", () => {
  beforeEach(() => {
    create.mockReset();
    createMany.mockReset();
    findMany.mockReset();
    pushAfterInternalNotification.mockReset();
    pushAfterInternalNotifications.mockReset();
    auth.mockReset();
    revalidatePath.mockReset();

    create.mockResolvedValue({ id: "notif-1" });
    pushAfterInternalNotification.mockResolvedValue(undefined);
    pushAfterInternalNotifications.mockResolvedValue(undefined);
  });

  it("crée la notification interne puis déclenche un push unique", async () => {
    const result = await createNotification({
      userId: "user-a",
      type: TypeNotification.Systeme,
      titre: "Annonce",
      message: "Contenu important",
      lien: "/evenements/e1",
    });

    expect(result).toMatchObject({ success: true, id: "notif-1" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-a",
        titre: "Annonce",
        message: "Contenu important",
        lien: "/evenements/e1",
        lue: false,
      }),
    });

    // Laisser la microtask du dynamic import + void
    await vi.waitFor(() => {
      expect(pushAfterInternalNotification).toHaveBeenCalledTimes(1);
    });
    expect(pushAfterInternalNotification).toHaveBeenCalledWith("user-a", {
      titre: "Annonce",
      message: "Contenu important",
      lien: "/evenements/e1",
    });
  });

  it("échec push n'échoue pas la création métier", async () => {
    pushAfterInternalNotification.mockRejectedValue(new Error("push fail"));

    const result = await createNotification({
      userId: "user-a",
      type: TypeNotification.Systeme,
      titre: "T",
      message: "M",
    });

    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("createNotifications + push groupé", () => {
  beforeEach(() => {
    create.mockReset();
    createMany.mockReset();
    findMany.mockReset();
    pushAfterInternalNotification.mockReset();
    pushAfterInternalNotifications.mockReset();
    auth.mockReset();
    revalidatePath.mockReset();

    auth.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });
    findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    createMany.mockResolvedValue({ count: 2 });
    pushAfterInternalNotifications.mockResolvedValue(undefined);
  });

  it("crée en base puis push une seule fois vers les utilisateurs valides", async () => {
    const result = await createNotifications({
      userIds: ["u1", "u2", "u-missing"],
      type: TypeNotification.Systeme,
      titre: "Broadcast",
      message: "Hello all",
      lien: "/notifications",
    });

    expect(result).toMatchObject({ success: true, count: 2 });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(pushAfterInternalNotification).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(pushAfterInternalNotifications).toHaveBeenCalledTimes(1);
    });
    expect(pushAfterInternalNotifications).toHaveBeenCalledWith(["u1", "u2"], {
      titre: "Broadcast",
      message: "Hello all",
      lien: "/notifications",
    });
  });

  it("absence de double push unitaire quand createNotifications est utilisé", async () => {
    findMany.mockResolvedValue([{ id: "u1" }]);
    createMany.mockResolvedValue({ count: 1 });

    await createNotifications({
      userIds: ["u1"],
      type: TypeNotification.Action,
      titre: "T",
      message: "M",
    });

    await vi.waitFor(() => {
      expect(pushAfterInternalNotifications).toHaveBeenCalledTimes(1);
    });
    expect(pushAfterInternalNotification).toHaveBeenCalledTimes(0);
  });
});

describe("anti-doublon architectural", () => {
  it("chat et paiements n'importent pas createNotification", async () => {
    const fs = await import("node:fs/promises");
    const chat = await fs.readFile(
      new URL("../chat/send-my-message.ts", import.meta.url),
      "utf8"
    );
    const payment = await fs.readFile(
      new URL("../paiements/declare-bank-wero-payment.ts", import.meta.url),
      "utf8"
    );
    expect(chat).not.toMatch(/createNotification/);
    expect(payment).not.toMatch(/createNotification/);
    expect(chat).toMatch(/sendPushToUsers/);
    expect(payment).toMatch(/sendPushToUser/);
  });
});
