import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent } = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
}));

const { buildPasseportPdfBufferMock } = vi.hoisted(() => ({
  buildPasseportPdfBufferMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: {
      findUnique: findUniqueAdherent,
    },
  },
}));

vi.mock("@/lib/services/passeport/build-passeport-pdf-buffer", () => ({
  buildPasseportPdfBuffer: buildPasseportPdfBufferMock,
}));

import { getMyPasseportPdf } from "@/lib/services/passeport/get-my-passeport-pdf";

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

const activeAdherent = {
  id: "adh-abc123456789",
  civility: "Monsieur",
  firstname: "Hubert",
  lastname: "Itomba",
  dateNaissance: new Date("1990-01-15"),
  profession: "Ingénieur",
  numeroPasseport: "AMAKI-2026-ABC123" as string | null,
  dateGenerationPasseport: new Date("2026-08-18T10:00:00.000Z"),
  User: {
    status: "Actif",
    email: "hubert@example.com",
    createdAt: new Date("2024-01-01"),
  },
  Adresse: [],
};

describe("getMyPasseportPdf", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    buildPasseportPdfBufferMock.mockReset();
    buildPasseportPdfBufferMock.mockResolvedValue(Buffer.from("%PDF-1.4"));
  });

  it("K — CONFLICT si numéro absent", async () => {
    findUniqueAdherent.mockResolvedValue({
      ...activeAdherent,
      numeroPasseport: null,
    });
    await expect(getMyPasseportPdf(actor())).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(buildPasseportPdfBufferMock).not.toHaveBeenCalled();
  });

  it("L — retourne Buffer PDF si numéro présent", async () => {
    findUniqueAdherent.mockResolvedValue(activeAdherent);
    const result = await getMyPasseportPdf(actor());
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.numeroPasseport).toBe("AMAKI-2026-ABC123");
    expect(result.filename).toBe("Passeport-AMAKI-AMAKI-2026-ABC123.pdf");
    expect(buildPasseportPdfBufferMock).toHaveBeenCalled();
  });

  it("M — charge adhérent via actor.userId", async () => {
    findUniqueAdherent.mockResolvedValue(activeAdherent);
    await getMyPasseportPdf(actor({ userId: "user-own" }));
    expect(findUniqueAdherent).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-own" } })
    );
  });
});
