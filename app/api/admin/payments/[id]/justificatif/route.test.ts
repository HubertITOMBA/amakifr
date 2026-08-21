import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";

const { authMock, getPaymentJustificatifForAdmin } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getPaymentJustificatifForAdmin: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));
vi.mock("@/lib/services/paiements/get-payment-justificatif", () => ({
  getPaymentJustificatifForAdmin,
}));

import { GET } from "@/app/api/admin/payments/[id]/justificatif/route";

beforeEach(() => {
  authMock.mockReset();
  getPaymentJustificatifForAdmin.mockReset();
});

describe("GET /api/admin/payments/[id]/justificatif", () => {
  it("401 sans session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET({} as Request, {
      params: Promise.resolve({ id: "pay-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("admin autorisé → fichier", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "a@a.fr", name: "A" },
    });
    getPaymentJustificatifForAdmin.mockResolvedValue({
      absolutePath: "/tmp/x.pdf",
      contentType: "application/pdf",
      downloadName: "decl_1.pdf",
      bytes: Buffer.from("%PDF"),
    });
    const res = await GET({} as Request, {
      params: Promise.resolve({ id: "pay-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("decl_1.pdf");
  });

  it("utilisateur normal → refus", async () => {
    authMock.mockResolvedValue({
      user: { id: "u-1", role: "MEMBRE", email: "m@m.fr", name: "M" },
    });
    getPaymentJustificatifForAdmin.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Accès refusé")
    );
    const res = await GET({} as Request, {
      params: Promise.resolve({ id: "pay-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("paiement inexistant", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "a@a.fr", name: "A" },
    });
    getPaymentJustificatifForAdmin.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Paiement introuvable")
    );
    const res = await GET({} as Request, {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("justificatif inexistant", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "a@a.fr", name: "A" },
    });
    getPaymentJustificatifForAdmin.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Justificatif introuvable")
    );
    const res = await GET({} as Request, {
      params: Promise.resolve({ id: "pay-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("path traversal id → validation", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "a@a.fr", name: "A" },
    });
    getPaymentJustificatifForAdmin.mockRejectedValue(
      new ServiceError("VALIDATION_ERROR", "Identifiant invalide")
    );
    const res = await GET({} as Request, {
      params: Promise.resolve({ id: "../etc/passwd" }),
    });
    expect(res.status).toBe(400);
  });
});
