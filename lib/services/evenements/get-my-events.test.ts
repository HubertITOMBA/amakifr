import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  count,
  findMany,
  findFirst,
  findUniqueEvent,
  createInscription,
  findFirstInscription,
  deleteInscription,
  updateEvent,
  updateManyEvent,
  transaction,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUniqueEvent: vi.fn(),
  createInscription: vi.fn(),
  findFirstInscription: vi.fn(),
  deleteInscription: vi.fn(),
  updateEvent: vi.fn(),
  updateManyEvent: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    evenement: {
      count,
      findMany,
      findFirst,
      findUnique: findUniqueEvent,
      update: updateEvent,
      updateMany: updateManyEvent,
    },
    inscriptionEvenement: {
      create: createInscription,
      findFirst: findFirstInscription,
      delete: deleteInscription,
    },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/mail", () => ({
  sendAdherentInscriptionConfirmationEmail: vi.fn(),
}));

import {
  getMyEvent,
  getMyEvents,
  getMyEventsSummary,
} from "@/lib/services/evenements/get-my-events";
import {
  registerMyEvent,
  withdrawMyEvent,
} from "@/lib/services/evenements/register-my-event";

const actor = (id = "u1"): AuthContext =>
  ({
    userId: id,
    email: "a@b.com",
    role: "MEMBRE",
    status: "Actif",
    adminRoles: [],
    adherentId: null,
    name: "Ada",
    sessionId: null,
    channel: "mobile",
  }) as AuthContext;

const nowWindow = {
  dateAffichage: new Date("2026-01-01"),
  dateFinAffichage: new Date("2026-12-31"),
};

describe("getMyEvents", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    count.mockReset();
    findMany.mockReset();
    findFirst.mockReset();
    findUniqueEvent.mockReset();
  });

  it("UNAUTHENTICATED sans userId", async () => {
    await expect(getMyEvents(actor(""))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("liste upcoming — brouillon exclu via where Publie", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([
      {
        id: "e1",
        titre: "AG",
        description: "desc",
        categorie: "General",
        statut: "Publie",
        dateDebut: new Date("2026-10-01"),
        dateFin: null,
        ...nowWindow,
        lieu: "Paris",
        inscriptionRequis: true,
        obligatoireParticipation: false,
        dateLimiteInscription: null,
        placesDisponibles: 10,
        placesReservees: 1,
        Inscriptions: [],
      },
    ]);
    const res = await getMyEvents(actor(), { scope: "upcoming" });
    expect(res.total).toBe(1);
    expect(res.items[0].titre).toBe("AG");
    expect(findMany.mock.calls[0][0].where.statut).toBe("Publie");
  });

  it("upcoming trié par dateDebut ASC — filtre métier sans createdAt", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await getMyEvents(actor(), { scope: "upcoming" });
    const args = findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ dateDebut: "asc" });
    expect(JSON.stringify(args.where)).not.toMatch(/createdAt/);
    expect(JSON.stringify(args.where)).not.toMatch(/dateAffichage/);
    expect(args.where.OR).toBeDefined();
  });

  it("past trié par dateDebut DESC — filtre métier sans createdAt", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await getMyEvents(actor(), { scope: "past" });
    const args = findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ dateDebut: "desc" });
    expect(JSON.stringify(args.where)).not.toMatch(/createdAt/);
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dateFin: expect.any(Object) }),
      ])
    );
  });

  it("summary prochain = dateDebut futur le plus proche (pas createdAt)", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    count.mockResolvedValue(2);
    findFirst.mockResolvedValue({
      id: "e1",
      titre: "AG",
      dateDebut: new Date("2026-10-01"),
      lieu: "Paris",
    });
    const s = await getMyEventsSummary(actor());
    expect(s.upcomingCount).toBe(2);
    expect(s.nextEvent?.titre).toBe("AG");
    const nextArgs = findFirst.mock.calls[0][0];
    expect(nextArgs.orderBy).toEqual({ dateDebut: "asc" });
    expect(nextArgs.where.dateDebut).toEqual({ gt: expect.any(Date) });
    expect(JSON.stringify(nextArgs.where)).not.toMatch(/createdAt/);
  });

  it("détail introuvable si brouillon", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    findUniqueEvent.mockResolvedValue({
      id: "e1",
      statut: "Brouillon",
      ...nowWindow,
      dateDebut: new Date("2026-10-01"),
      Inscriptions: [],
    });
    await expect(getMyEvent(actor(), "e1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("événement obligatoire Publie futur → détail 200 même si dateAffichage future", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    const futureAffichage = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    findUniqueEvent.mockResolvedValue({
      id: "e-obl",
      titre: "Obligatoire",
      description: "desc",
      contenu: null,
      categorie: "General",
      statut: "Publie",
      dateDebut: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      dateFin: null,
      dateAffichage: futureAffichage,
      dateFinAffichage: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      lieu: "Paris",
      adresse: null,
      prix: null,
      inscriptionRequis: false,
      obligatoireParticipation: true,
      dateLimiteInscription: null,
      placesDisponibles: null,
      placesReservees: 0,
      contactEmail: null,
      contactTelephone: null,
      imagePrincipale: null,
      tags: null,
      estPublic: false,
      Inscriptions: [],
    });
    const d = await getMyEvent(actor(), "e-obl");
    expect(d.id).toBe("e-obl");
    expect(d.obligatoireParticipation).toBe(true);
    expect(d.canRegister).toBe(false);
  });

  it("événement inscription → détail canRegister", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    findUniqueEvent.mockResolvedValue({
      id: "e-ins",
      titre: "Avec inscription",
      description: "desc",
      contenu: null,
      categorie: "General",
      statut: "Publie",
      dateDebut: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      dateFin: null,
      dateAffichage: new Date(Date.now() - 24 * 3600 * 1000),
      dateFinAffichage: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      lieu: "Lyon",
      adresse: null,
      prix: null,
      inscriptionRequis: true,
      obligatoireParticipation: false,
      dateLimiteInscription: null,
      placesDisponibles: 20,
      placesReservees: 0,
      contactEmail: null,
      contactTelephone: null,
      imagePrincipale: null,
      tags: null,
      estPublic: true,
      Inscriptions: [],
    });
    const d = await getMyEvent(actor(), "e-ins");
    expect(d.canRegister).toBe(true);
    expect(d.inscriptionRequis).toBe(true);
    expect(d.paiements).toEqual([]);
  });

  it("détail événement expose historique paiements avec destinationLabel", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    findUniqueEvent.mockResolvedValue({
      id: "e-pay",
      titre: "Gala",
      description: "desc",
      contenu: null,
      categorie: "General",
      statut: "Publie",
      dateDebut: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      dateFin: null,
      dateAffichage: new Date(Date.now() - 24 * 3600 * 1000),
      dateFinAffichage: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      lieu: "Paris",
      adresse: null,
      prix: 30,
      inscriptionRequis: true,
      obligatoireParticipation: false,
      dateLimiteInscription: null,
      placesDisponibles: 20,
      placesReservees: 1,
      contactEmail: null,
      contactTelephone: null,
      imagePrincipale: null,
      tags: null,
      estPublic: true,
      Inscriptions: [
        {
          id: "ins1",
          nombrePersonnes: 1,
          montantAttendu: 30,
          montantPaye: 30,
          statutPaiement: "Paye",
          statut: "EnAttente",
          Paiements: [
            {
              id: "pay1",
              montant: 30,
              moyenPaiement: "Wero",
              statut: "Valide",
              datePaiement: new Date("2026-09-06T18:00:00.000Z"),
              reference: "AMAKI-2026-EVT-XXXX",
            },
          ],
        },
      ],
    });
    const d = await getMyEvent(actor(), "e-pay");
    expect(d.paiements).toHaveLength(1);
    expect(d.paiements[0].destinationLabel).toBe("Événement — Gala");
    expect(d.paiements[0].montant).toBe("30");
    expect(d.canPay).toBe(false);
  });

  it("liste inscription + obligatoire exposent flags", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    count.mockResolvedValue(2);
    findMany.mockResolvedValue([
      {
        id: "e-ins",
        titre: "A",
        description: "d",
        categorie: "General",
        statut: "Publie",
        dateDebut: new Date(Date.now() + 10 * 24 * 3600 * 1000),
        dateFin: null,
        ...nowWindow,
        lieu: null,
        inscriptionRequis: true,
        obligatoireParticipation: false,
        dateLimiteInscription: null,
        placesDisponibles: 5,
        placesReservees: 0,
        Inscriptions: [],
      },
      {
        id: "e-obl",
        titre: "B",
        description: "d",
        categorie: "General",
        statut: "Publie",
        dateDebut: new Date(Date.now() + 20 * 24 * 3600 * 1000),
        dateFin: null,
        ...nowWindow,
        lieu: null,
        inscriptionRequis: false,
        obligatoireParticipation: true,
        dateLimiteInscription: null,
        placesDisponibles: null,
        placesReservees: 0,
        Inscriptions: [],
      },
    ]);
    const res = await getMyEvents(actor(), { scope: "upcoming" });
    expect(res.items[0].canRegister).toBe(true);
    expect(res.items[1].obligatoireParticipation).toBe(true);
    expect(res.items[1].canRegister).toBe(false);
  });
});

describe("registerMyEvent / withdrawMyEvent", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    transaction.mockReset();
    findUniqueAdherent.mockResolvedValue({
      id: "ad1",
      civility: "Madame",
      firstname: "Ada",
      lastname: "Lovelace",
      User: { email: "a@b.com" },
    });
  });

  it("refuse capacité", async () => {
    transaction.mockImplementation(async (fn: any) => {
      const tx = {
        evenement: {
          findUnique: vi.fn().mockResolvedValue({
            id: "e1",
            statut: "Publie",
            titre: "AG",
            dateDebut: new Date("2026-10-01"),
            lieu: "Paris",
            inscriptionRequis: true,
            dateLimiteInscription: null,
            placesDisponibles: 2,
            placesReservees: 2,
            ...nowWindow,
          }),
          updateMany: vi.fn(),
        },
        inscriptionEvenement: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
      };
      return fn(tx);
    });
    await expect(
      registerMyEvent(actor(), "e1", { nombrePersonnes: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("withdraw ownership — inscription autre user introuvable", async () => {
    transaction.mockImplementation(async (fn: any) => {
      const tx = {
        inscriptionEvenement: {
          findFirst: vi.fn().mockResolvedValue(null),
          delete: vi.fn(),
        },
        evenement: { update: vi.fn() },
      };
      return fn(tx);
    });
    await expect(withdrawMyEvent(actor(), "e1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("register succès", async () => {
    transaction.mockImplementation(async (fn: any) => {
      const tx = {
        evenement: {
          findUnique: vi.fn().mockResolvedValue({
            id: "e1",
            statut: "Publie",
            titre: "AG",
            dateDebut: new Date("2026-10-01"),
            lieu: "Paris",
            prix: null,
            inscriptionRequis: true,
            dateLimiteInscription: null,
            placesDisponibles: 10,
            placesReservees: 1,
            ...nowWindow,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        inscriptionEvenement: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "ins1",
            nombrePersonnes: 1,
            montantAttendu: 0,
            statutPaiement: "NonApplicable",
          }),
        },
      };
      return fn(tx);
    });
    const res = await registerMyEvent(actor(), "e1", { nombrePersonnes: 1 });
    expect(res.inscriptionId).toBe("ins1");
  });
});
