import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";
import path from "path";

const { findUnique, authorizeMock, accessMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  authorizeMock: vi.fn(),
  accessMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    paiementCotisation: { findUnique },
  },
}));
vi.mock("@/lib/authorize", () => ({
  authorize: authorizeMock,
}));
vi.mock("fs/promises", () => ({
  access: accessMock,
  readFile: vi.fn(async () => Buffer.from("%PDF")),
}));

import {
  getPaymentJustificatifForAdmin,
  resolveJustificatifAbsolutePath,
} from "@/lib/services/paiements/get-payment-justificatif";

function admin(): AuthContext {
  return {
    userId: "admin-1",
    role: "ADMIN",
    status: "Actif",
    email: "a@a.fr",
    name: "Admin",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "web",
  };
}

function member(): AuthContext {
  return { ...admin(), userId: "user-1", role: "MEMBRE" };
}

beforeEach(() => {
  findUnique.mockReset();
  authorizeMock.mockReset();
  accessMock.mockReset();
  authorizeMock.mockResolvedValue(undefined);
  accessMock.mockResolvedValue(undefined);
});

describe("resolveJustificatifAbsolutePath", () => {
  it("résout chemin privé sans traversal", () => {
    const p = resolveJustificatifAbsolutePath(
      "private/justificatifs-paiements/decl_1.pdf"
    );
    expect(p).toBe(
      path.join(process.cwd(), "storage", "justificatifs-paiements", "decl_1.pdf")
    );
  });

  it("refuse traversal", () => {
    expect(() =>
      resolveJustificatifAbsolutePath(
        "private/justificatifs-paiements/../../etc/passwd"
      )
    ).toThrow();
  });

  it("résout legacy public", () => {
    const p = resolveJustificatifAbsolutePath(
      "/ressources/justificatifs-paiements/virement_1.pdf"
    );
    expect(p).toContain(
      path.join("public", "ressources", "justificatifs-paiements", "virement_1.pdf")
    );
  });
});

describe("getPaymentJustificatifForAdmin", () => {
  it("OK admin", async () => {
    findUnique.mockResolvedValue({
      id: "pay-1",
      justificatifChemin: "private/justificatifs-paiements/decl_1.pdf",
      reference: "REF",
    });
    const r = await getPaymentJustificatifForAdmin(admin(), "pay-1");
    expect(r.downloadName).toBe("decl_1.pdf");
    expect(r.contentType).toBe("application/pdf");
    expect(authorizeMock).toHaveBeenCalled();
  });

  it("membre → FORBIDDEN via authorize", async () => {
    authorizeMock.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Accès refusé")
    );
    await expect(
      getPaymentJustificatifForAdmin(member(), "pay-1")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("paiement inexistant", async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      getPaymentJustificatifForAdmin(admin(), "missing")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("justificatif absent en base", async () => {
    findUnique.mockResolvedValue({
      id: "pay-1",
      justificatifChemin: null,
      reference: null,
    });
    await expect(
      getPaymentJustificatifForAdmin(admin(), "pay-1")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("fichier manquant sur disque", async () => {
    findUnique.mockResolvedValue({
      id: "pay-1",
      justificatifChemin: "private/justificatifs-paiements/decl_1.pdf",
      reference: null,
    });
    const { readFile } = await import("fs/promises");
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    await expect(
      getPaymentJustificatifForAdmin(admin(), "pay-1")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("id avec path traversal refusé", async () => {
    await expect(
      getPaymentJustificatifForAdmin(admin(), "../pay-1")
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
