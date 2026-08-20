import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent, findManyReunions } = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findManyReunions: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    reunionMensuelle: { findMany: findManyReunions },
  },
}));

import { getMyReunions } from "@/lib/services/reunions/get-my-reunions";

function actor(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    role: "MEMBRE",
    status: "Actif",
    email: "a@example.com",
    name: "Ada",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "web",
    ...overrides,
  };
}

beforeEach(() => {
  findUniqueAdherent.mockReset();
  findManyReunions.mockReset();
});

describe("getMyReunions", () => {
  it("UNAUTHENTICATED si userId vide", async () => {
    await expect(getMyReunions(actor({ userId: "" }))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(getMyReunions(actor())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("retourne [] si aucune réunion", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([]);
    await expect(getMyReunions(actor())).resolves.toEqual([]);
  });

  it("projette domicile avec adresse hôte et téléphones (future)", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r1",
        annee: 2026,
        mois: 3,
        dateReunion: new Date("2027-03-14T18:00:00.000Z"),
        statut: "DateConfirmee",
        typeLieu: "Domicile",
        adresse: null,
        nomRestaurant: null,
        commentaires: "Apportez un plat",
        AdherentHote: {
          id: "adh-hote",
          firstname: "Bob",
          lastname: "Dupont",
          Adresse: [
            {
              label: "12 rue Example, 75000 Paris",
              streetnum: null,
              street1: null,
              street2: null,
              codepost: null,
              city: null,
              country: null,
            },
          ],
          Telephones: [
            { numero: "0601020304", type: "Mobile", estPrincipal: true },
          ],
        },
        Participations: [{ statut: "Present" }],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0]).toMatchObject({
      lieuLabel: "Chez Bob Dupont",
      lieuAdresse: "12 rue Example, 75000 Paris",
      hostName: "Bob Dupont",
      hostTelephones: [{ numero: "0601020304", type: "Mobile" }],
      canUpdateParticipation: true,
      dateReunion: "2027-03-14T18:00:00.000Z",
    });
    const json = JSON.stringify(result[0]);
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/Adresse\[/);
  });

  it("restaurant → adresse publique, pas d'autres adresses hôte", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r2",
        annee: 2026,
        mois: 4,
        dateReunion: new Date("2027-04-10T18:00:00.000Z"),
        statut: "DateConfirmee",
        typeLieu: "Restaurant",
        adresse: "1 place République, Lyon",
        nomRestaurant: "Le Bistrot",
        commentaires: null,
        AdherentHote: {
          id: "adh-hote",
          firstname: "Bob",
          lastname: "Dupont",
          Adresse: [{ label: "Adresse privée hôte" }],
          Telephones: [{ numero: "0601020304", type: "Mobile", estPrincipal: true }],
        },
        Participations: [],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0].lieuLabel).toBe("Restaurant Le Bistrot");
    expect(result[0].lieuAdresse).toBe("1 place République, Lyon");
    expect(result[0].lieuAdresse).not.toContain("Adresse privée");
  });

  it("historique masque adresse et téléphones hôte", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r-past",
        annee: 2025,
        mois: 12,
        dateReunion: new Date("2025-12-01T18:00:00.000Z"),
        statut: "DateConfirmee",
        typeLieu: "Domicile",
        adresse: null,
        nomRestaurant: null,
        commentaires: null,
        AdherentHote: {
          id: "adh-hote",
          firstname: "Bob",
          lastname: "Dupont",
          Adresse: [{ label: "12 rue Example" }],
          Telephones: [{ numero: "0601020304", type: "Mobile", estPrincipal: true }],
        },
        Participations: [{ statut: "Present" }],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0].hostName).toBe("Bob Dupont");
    expect(result[0].participationStatus).toBe("Present");
    expect(result[0].lieuAdresse).toBeNull();
    expect(result[0].hostTelephones).toBeNull();
    expect(result[0].canUpdateParticipation).toBe(false);
  });

  it("EnAttente → dateReunion null même si date provisoire en base", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r-wait",
        annee: 2026,
        mois: 5,
        dateReunion: new Date("2026-05-10T18:00:00.000Z"),
        statut: "EnAttente",
        typeLieu: "Domicile",
        adresse: null,
        nomRestaurant: null,
        commentaires: null,
        AdherentHote: null,
        Participations: [],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0].dateReunion).toBeNull();
    expect(result[0].lieuLabel).toBe("Hôte à désigner");
    expect(result[0].canUpdateParticipation).toBe(false);
  });

  it("DateConfirmee future + adresse réunion → adresse présente (sans exiger hôte)", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r-addr",
        annee: 2027,
        mois: 9,
        dateReunion: new Date("2027-09-11T18:00:00.000Z"),
        statut: "DateConfirmee",
        typeLieu: "Autre",
        adresse: "Hôtel Mercure, 10 av. Test",
        nomRestaurant: null,
        commentaires: null,
        AdherentHote: null,
        Participations: [],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0].lieuAdresse).toBe("Hôtel Mercure, 10 av. Test");
    expect(result[0].hostTelephones).toBeNull();
    expect(result[0].canUpdateParticipation).toBe(true);
  });

  it("DateConfirmee future + domicile + fallback adresse hôte → adresse + téléphone", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r-dom",
        annee: 2027,
        mois: 10,
        dateReunion: new Date("2027-10-09T18:00:00.000Z"),
        statut: "DateConfirmee",
        typeLieu: "Domicile",
        adresse: null,
        nomRestaurant: null,
        commentaires: null,
        AdherentHote: {
          id: "adh-hote",
          firstname: "Jean",
          lastname: "Dupont",
          Adresse: [{ label: "5 rue de la Paix, 75002 Paris" }],
          Telephones: [
            { numero: "0611223344", type: "Mobile", estPrincipal: true },
          ],
        },
        Participations: [],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0].lieuAdresse).toBe("5 rue de la Paix, 75002 Paris");
    expect(result[0].hostTelephones).toEqual([
      { numero: "0611223344", type: "Mobile" },
    ]);
  });

  it("EnAttente sans adresse → pas d'adresse fictive ni fallback hôte", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r-wait-host",
        annee: 2027,
        mois: 11,
        dateReunion: null,
        statut: "EnAttente",
        typeLieu: "Domicile",
        adresse: null,
        nomRestaurant: null,
        commentaires: null,
        AdherentHote: {
          id: "adh-hote",
          firstname: "Alice",
          lastname: "Martin",
          Adresse: [{ label: "99 rue Privée" }],
          Telephones: [
            { numero: "0699887766", type: "Mobile", estPrincipal: true },
          ],
        },
        Participations: [],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0].lieuAdresse).toBeNull();
    expect(result[0].hostName).toBe("Alice Martin");
    expect(result[0].hostTelephones).toEqual([
      { numero: "0699887766", type: "Mobile" },
    ]);
    expect(result[0].canUpdateParticipation).toBe(false);
  });

  it("MoisValide sans adresse → pas d'adresse fictive", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r-mois",
        annee: 2027,
        mois: 12,
        dateReunion: null,
        statut: "MoisValide",
        typeLieu: "Domicile",
        adresse: null,
        nomRestaurant: null,
        commentaires: null,
        AdherentHote: {
          id: "adh-hote",
          firstname: "Bob",
          lastname: "Dupont",
          Adresse: [{ label: "1 rue Test" }],
          Telephones: [],
        },
        Participations: [],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0].lieuAdresse).toBeNull();
    expect(result[0].canUpdateParticipation).toBe(false);
  });

  it("réunion sans hôte → pas de téléphone, adresse Autre conservée", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r-no-host",
        annee: 2026,
        mois: 6,
        dateReunion: new Date("2027-06-20T18:00:00.000Z"),
        statut: "DateConfirmee",
        typeLieu: "Autre",
        adresse: "Salle communale",
        nomRestaurant: null,
        commentaires: null,
        AdherentHote: null,
        Participations: [],
      },
    ]);

    const result = await getMyReunions(actor());
    expect(result[0].hostTelephones).toBeNull();
    expect(result[0].hostName).toBeNull();
    expect(result[0].lieuAdresse).toBe("Salle communale");
  });

  it("filtre la participation uniquement pour l'adhérent courant", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findManyReunions.mockResolvedValue([]);
    await getMyReunions(actor({ userId: "user-A" }));
    expect(findManyReunions).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          Participations: expect.objectContaining({
            where: { adherentId: "adh-A" },
          }),
        }),
      })
    );
  });

  it("INTERNAL_ERROR si Prisma échoue", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockRejectedValue(new Error("db down"));
    await expect(getMyReunions(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
