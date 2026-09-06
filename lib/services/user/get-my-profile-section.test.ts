import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique },
  },
}));

import {
  getMyProfileSection,
  parseProfileSection,
} from "@/lib/services/user/get-my-profile-section";

const actor = (id = "u1"): AuthContext =>
  ({
    userId: id,
    email: "a@b.com",
    role: "MEMBRE",
    status: "Actif",
    adminRoles: [],
    adherentId: null,
  }) as AuthContext;

describe("parseProfileSection", () => {
  it("accepte summary", () => {
    expect(parseProfileSection("summary")).toBe("summary");
  });

  it("refuse section inconnue", () => {
    expect(() => parseProfileSection("rgpd")).toThrow();
  });
});

describe("getMyProfileSection", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("summary — sans adresses/téléphones détaillés", async () => {
    findUnique.mockResolvedValue({
      name: "Ada",
      email: "a@b.com",
      image: null,
      role: "MEMBRE",
      status: "Actif",
      adherent: {
        id: "ad1",
        firstname: "Ada",
        lastname: "Lovelace",
        Adresse: [{ id: "addr1" }],
        Telephones: [],
      },
    });
    const data = await getMyProfileSection(actor(), "summary");
    expect(data).toEqual({
      name: "Ada",
      email: "a@b.com",
      image: null,
      role: "MEMBRE",
      status: "Actif",
      hasIdentity: true,
      hasCoordonnees: true,
      hasContact: false,
    });
  });

  it("account — lastLogin ISO", async () => {
    findUnique.mockResolvedValue({
      email: "a@b.com",
      role: "MEMBRE",
      status: "Actif",
      lastLogin: new Date("2026-09-06T13:42:00.000Z"),
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    const data = await getMyProfileSection(actor(), "account");
    expect(data).toMatchObject({
      email: "a@b.com",
      lastLogin: "2026-09-06T13:42:00.000Z",
    });
  });

  it("contact — téléphones uniquement", async () => {
    findUnique.mockResolvedValue({
      adherent: {
        Telephones: [
          {
            id: "t1",
            numero: "0600000000",
            type: "Mobile",
            estPrincipal: true,
            description: null,
          },
        ],
      },
    });
    const data = await getMyProfileSection(actor(), "contact");
    expect(data).toEqual({
      telephones: [
        {
          id: "t1",
          numero: "0600000000",
          type: "Mobile",
          estPrincipal: true,
          description: null,
        },
      ],
    });
  });
});
