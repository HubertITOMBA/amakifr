import { describe, expect, it, vi } from "vitest";
import { TypeNotification } from "@prisma/client";
import {
  notifySondagePublishedInApp,
  sondageNotificationLien,
} from "@/lib/sondages-notifications";

describe("sondageNotificationLien", () => {
  it("lien canonique /sondages/:id", () => {
    expect(sondageNotificationLien("abc")).toBe("/sondages/abc");
  });
});

describe("notifySondagePublishedInApp", () => {
  const sondage = {
    id: "quiz-live-fictif-1",
    sujet: "Quiz fiction DEV",
    introduction: null,
    dateDebut: new Date(),
    dateFin: new Date(),
    kind: "Quiz",
  };

  it("notifie un adhérent actif éligible + appelle le push simulé", async () => {
    const createNotifications = vi.fn(async (args) => args.userIds.length);
    const pushAfter = vi.fn(async () => undefined);

    const result = await notifySondagePublishedInApp(sondage, {
      listEligibleUserIds: async () => ["actif-ok", "autre-actif"],
      findExistingLiens: async () => new Set(),
      createNotifications,
      pushAfter,
    });

    expect(result.createdCount).toBe(2);
    expect(result.recipientUserIds).toEqual(["actif-ok", "autre-actif"]);
    expect(createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ["actif-ok", "autre-actif"],
        lien: "/sondages/quiz-live-fictif-1",
        type: TypeNotification.Systeme,
        titre: "Quiz publié",
      })
    );
    expect(pushAfter).toHaveBeenCalledWith(
      ["actif-ok", "autre-actif"],
      expect.objectContaining({
        lien: "/sondages/quiz-live-fictif-1",
        titre: "Quiz publié",
      })
    );
  });

  it("exclut les destinataires hors public (liste éligible vide / filtrée en amont)", async () => {
    const createNotifications = vi.fn(async () => 0);
    const pushAfter = vi.fn(async () => undefined);

    // Simule : inactif / hors public déjà exclus par listEligibleUserIds
    const result = await notifySondagePublishedInApp(
      { ...sondage, kind: "Sondage", sujet: "Sondage fiction" },
      {
        listEligibleUserIds: async () => [],
        createNotifications,
        pushAfter,
      }
    );

    expect(result.createdCount).toBe(0);
    expect(createNotifications).not.toHaveBeenCalled();
    expect(pushAfter).not.toHaveBeenCalled();
  });

  it("ne crée pas de doublon à la republication", async () => {
    const createNotifications = vi.fn(async () => 0);
    const pushAfter = vi.fn(async () => undefined);

    const result = await notifySondagePublishedInApp(sondage, {
      listEligibleUserIds: async () => ["actif-ok"],
      findExistingLiens: async () => new Set(["actif-ok"]),
      createNotifications,
      pushAfter,
    });

    expect(result.createdCount).toBe(0);
    expect(result.skippedDuplicateCount).toBe(1);
    expect(createNotifications).not.toHaveBeenCalled();
    expect(pushAfter).not.toHaveBeenCalled();
  });

  it("Sondage / Quiz classique / Quiz en direct : même mécanisme (kind dans le titre)", async () => {
    for (const kind of ["Sondage", "Quiz"] as const) {
      const createNotifications = vi.fn(async (args) => args.userIds.length);
      const pushAfter = vi.fn(async () => undefined);
      const res = await notifySondagePublishedInApp(
        { ...sondage, id: `id-${kind}`, kind, sujet: `${kind} fiction` },
        {
          listEligibleUserIds: async () => ["u1"],
          findExistingLiens: async () => new Set(),
          createNotifications,
          pushAfter,
        }
      );
      expect(res.createdCount).toBe(1);
      expect(createNotifications.mock.calls[0]![0].titre).toMatch(/publié$/);
      expect(createNotifications.mock.calls[0]![0].lien).toBe(
        `/sondages/id-${kind}`
      );
      expect(pushAfter).toHaveBeenCalledTimes(1);
    }
  });
});
