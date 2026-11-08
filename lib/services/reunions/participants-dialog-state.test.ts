import { describe, expect, it, vi } from "vitest";
import {
  buildParticipantsState,
  countListParticipationBadges,
  countParticipationStats,
  hasUnsavedParticipantsEdits,
  isParticipantsLoadGenerationCurrent,
  nextParticipantsLoadGeneration,
  raceParticipantsLoadWithTimeout,
  NON_REPONDU_PERIMETER_HINT,
  PARTICIPANTS_DIALOG_LOAD_TIMEOUT_MESSAGE,
  PARTICIPANTS_REFRESH_DISCARD_MESSAGE,
} from "@/lib/services/reunions/participants-dialog-state";

describe("buildParticipantsState — rôles bureau / inactifs", () => {
  it("conserve une réponse ADMIN actif hors liste partielle via union", () => {
    const { merged, edits } = buildParticipantsState(
      [
        {
          adherentId: "admin-adh",
          statut: "Present",
          justificatifFournit: false,
          Adherent: {
            firstname: "Ada",
            lastname: "Admin",
            User: { email: "a@x.fr", role: "ADMIN", status: "Actif" },
          },
        },
      ],
      [
        {
          id: "m1",
          firstname: "Marc",
          lastname: "Membre",
          email: "m@x.fr",
          role: "MEMBRE",
          userStatus: "Actif",
        },
      ]
    );

    expect(merged.map((a) => a.id).sort()).toEqual(["admin-adh", "m1"]);
    expect(edits["admin-adh"].statut).toBe("Present");
    expect(edits["m1"].statut).toBe("NonRepondu");
  });

  it("marque Inactif une fiche issue uniquement des participations", () => {
    const { merged } = buildParticipantsState(
      [
        {
          adherentId: "old",
          statut: "Excuse",
          justificatifFournit: true,
          Adherent: {
            firstname: "Old",
            lastname: "Member",
            User: { email: "o@x.fr", role: "MEMBRE", status: "Inactif" },
          },
        },
      ],
      []
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].userStatus).toBe("Inactif");
  });

  it("n'invente pas de provenance mobile/admin", () => {
    const { initial } = buildParticipantsState(
      [{ adherentId: "a1", statut: "Present", Adherent: { firstname: "A", lastname: "B", User: { status: "Actif" } } }],
      [{ id: "a2", firstname: "C", lastname: "D", email: "", role: "MEMBRE", userStatus: "Actif" }]
    );
    expect(initial["a1"]).toEqual({
      kind: "row",
      statut: "Present",
      justificatifFournit: false,
    });
    expect(initial["a2"]).toEqual({ kind: "absent" });
    expect(NON_REPONDU_PERIMETER_HINT.toLowerCase()).toContain("actifs");
  });
});

describe("compteurs liste ↔ dialogue", () => {
  it("P/A/E liste = badges sur participations fraîches", () => {
    expect(
      countListParticipationBadges([
        { statut: "Present" },
        { statut: "Present" },
        { statut: "Absent" },
        { statut: "Excuse" },
        { statut: "NonRepondu" },
      ])
    ).toEqual({ presents: 2, absents: 1, excuses: 1 });
  });

  it("dialogue : Non répondu = actifs sans réponse ; inactif répondant compte en P/A/E", () => {
    const { merged, edits } = buildParticipantsState(
      [
        {
          adherentId: "inact",
          statut: "Present",
          Adherent: {
            firstname: "I",
            lastname: "N",
            User: { status: "Inactif", role: "MEMBRE" },
          },
        },
      ],
      [
        {
          id: "actif1",
          firstname: "A",
          lastname: "1",
          email: "",
          role: "MEMBRE",
          userStatus: "Actif",
        },
        {
          id: "presid",
          firstname: "P",
          lastname: "R",
          email: "",
          role: "PRESID",
          userStatus: "Actif",
        },
      ]
    );

    const stats = countParticipationStats(merged, edits);
    expect(stats.presents).toBe(1);
    expect(stats.absents).toBe(0);
    expect(stats.excuses).toBe(0);
    expect(stats.nonRepondus).toBe(2);
  });
});

describe("hasUnsavedParticipantsEdits", () => {
  it("false si edits = initial", () => {
    const { initial, edits } = buildParticipantsState(
      [{ adherentId: "a1", statut: "Present", Adherent: { firstname: "A", lastname: "B", User: { status: "Actif" } } }],
      [{ id: "a2", firstname: "C", lastname: "D", email: "", role: "MEMBRE", userStatus: "Actif" }]
    );
    expect(hasUnsavedParticipantsEdits(initial, edits)).toBe(false);
  });

  it("true si statut édité sans enregistrement", () => {
    const { initial, edits } = buildParticipantsState(
      [],
      [{ id: "a2", firstname: "C", lastname: "D", email: "", role: "MEMBRE", userStatus: "Actif" }]
    );
    const dirty = {
      ...edits,
      a2: { statut: "Present", justificatifFournit: false },
    };
    expect(hasUnsavedParticipantsEdits(initial, dirty)).toBe(true);
  });

  it("true si retour à NonRepondu depuis une ligne attendue", () => {
    const { initial, edits } = buildParticipantsState(
      [
        {
          adherentId: "a1",
          statut: "Absent",
          justificatifFournit: false,
          Adherent: { firstname: "A", lastname: "B", User: { status: "Actif" } },
        },
      ],
      []
    );
    expect(hasUnsavedParticipantsEdits(initial, edits)).toBe(false);
    expect(
      hasUnsavedParticipantsEdits(initial, {
        a1: { statut: "NonRepondu", justificatifFournit: false },
      })
    ).toBe(true);
  });

  it("message de confirmation non vide", () => {
    expect(PARTICIPANTS_REFRESH_DISCARD_MESSAGE.length).toBeGreaterThan(10);
  });
});

describe("génération / timeout chargement dialogue participants", () => {
  it("incrémente la génération et lie la réunion", () => {
    const g1 = nextParticipantsLoadGeneration(0, "reu-a");
    const g2 = nextParticipantsLoadGeneration(g1.seq, "reu-b");
    expect(g1).toEqual({ seq: 1, reunionId: "reu-a" });
    expect(g2).toEqual({ seq: 2, reunionId: "reu-b" });
  });

  it("ignore une réponse d'une autre génération ou réunion", () => {
    const active = nextParticipantsLoadGeneration(0, "reu-a");
    expect(isParticipantsLoadGenerationCurrent(active, active)).toBe(true);
    expect(
      isParticipantsLoadGenerationCurrent(active, {
        seq: active.seq,
        reunionId: "reu-other",
      })
    ).toBe(false);
    expect(
      isParticipantsLoadGenerationCurrent(active, {
        seq: active.seq + 1,
        reunionId: "reu-a",
      })
    ).toBe(false);
    expect(isParticipantsLoadGenerationCurrent(null, active)).toBe(false);
  });

  it("fermeture = génération invalidée (réponse tardive ignorée)", () => {
    const openGen = nextParticipantsLoadGeneration(0, "reu-a");
    const afterClose = nextParticipantsLoadGeneration(openGen.seq, "");
    // après close, active=null côté UI ; une réponse openGen est obsolète
    expect(isParticipantsLoadGenerationCurrent(null, openGen)).toBe(false);
    expect(afterClose.seq).toBeGreaterThan(openGen.seq);
  });

  it("timeout UI sans annuler la promesse sous-jacente", async () => {
    vi.useFakeTimers();
    let settled = false;
    const work = new Promise<string>((resolve) => {
      setTimeout(() => {
        settled = true;
        resolve("late");
      }, 30_000);
    });
    const raced = raceParticipantsLoadWithTimeout(work, 50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(raced).resolves.toEqual({ status: "timeout" });
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    await work;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("succès avant timeout", async () => {
    await expect(
      raceParticipantsLoadWithTimeout(Promise.resolve({ ok: true }), 1000)
    ).resolves.toEqual({ status: "ok", value: { ok: true } });
  });

  it("message timeout explicite", () => {
    expect(PARTICIPANTS_DIALOG_LOAD_TIMEOUT_MESSAGE.toLowerCase()).toContain(
      "chargement"
    );
  });
});
