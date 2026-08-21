import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const {
  resolveApiActorMock,
  getActiveAssociationPaymentAccount,
  declareBankOrWeroPayment,
  mkdir,
  writeFile,
} = vi.hoisted(() => ({
  resolveApiActorMock: vi.fn(),
  getActiveAssociationPaymentAccount: vi.fn(),
  declareBankOrWeroPayment: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: resolveApiActorMock,
}));
vi.mock("@/lib/services/payment-accounts/get-active-payment-account", () => ({
  getActiveAssociationPaymentAccount,
}));
vi.mock("@/lib/services/paiements/declare-bank-wero-payment", () => ({
  declareBankOrWeroPayment,
}));
vi.mock("fs/promises", () => ({
  mkdir,
  writeFile,
}));

import { GET as getPaymentAccountRoute } from "@/app/api/v1/me/payment-account/route";
import { POST as postBankTransferRoute } from "@/app/api/v1/me/payments/bank-transfer/route";

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
    channel: "mobile",
    ...overrides,
  };
}

function getReq(url: string) {
  const nextUrl = new URL(url);
  return {
    nextUrl,
    headers: { get: () => null },
  } as any;
}

function multipartReq(
  fields: Record<string, string>,
  file?: { name: string; type: string; size: number; content?: string },
  extraKeys: string[] = []
) {
  const map = new Map<string, FormDataEntryValue>();
  for (const [k, v] of Object.entries(fields)) {
    map.set(k, v);
  }
  for (const k of extraKeys) {
    map.set(k, "injected");
  }
  if (file) {
    const blob = new File([file.content ?? "x"], file.name, {
      type: file.type,
    });
    Object.defineProperty(blob, "size", { value: file.size });
    map.set("justificatif", blob);
  }

  return {
    nextUrl: new URL("http://localhost/api/v1/me/payments/bank-transfer"),
    method: "POST",
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type"
          ? "multipart/form-data; boundary=----x"
          : null,
    },
    formData: async () => ({
      has: (k: string) => map.has(k),
      get: (k: string) => map.get(k) ?? null,
    }),
  } as any;
}

beforeEach(() => {
  resolveApiActorMock.mockReset();
  getActiveAssociationPaymentAccount.mockReset();
  declareBankOrWeroPayment.mockReset();
  mkdir.mockResolvedValue(undefined);
  writeFile.mockResolvedValue(undefined);
});

describe("GET /api/v1/me/payment-account", () => {
  it("401 sans auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getPaymentAccountRoute(
      getReq("http://localhost/api/v1/me/payment-account")
    );
    expect(res.status).toBe(401);
  });

  it("compte actif", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getActiveAssociationPaymentAccount.mockResolvedValue({
      libelle: "Principal",
      titulaire: "AMAKI",
      iban: "FR1420041010050500013M02606",
      bic: "PSSTFRPP",
      codeBanque: "20041",
      codeGuichet: "01005",
      numeroCompte: "0500013M026",
      cleRib: "06",
      telephoneWero: "+33612345678",
      weroActif: true,
    });
    const res = await getPaymentAccountRoute(
      getReq("http://localhost/api/v1/me/payment-account")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.account.iban).toBe("FR1420041010050500013M02606");
    expect(json.data.account.weroActif).toBe(true);
    expect(json.data.account).not.toHaveProperty("id");
    expect(json.data.account).not.toHaveProperty("createdBy");
    expect(json.data.account).not.toHaveProperty("actifPourPaiement");
  });

  it("aucun compte actif", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getActiveAssociationPaymentAccount.mockResolvedValue(null);
    const res = await getPaymentAccountRoute(
      getReq("http://localhost/api/v1/me/payment-account")
    );
    const json = await res.json();
    expect(json.data.account).toBeNull();
  });

  it("Wero inactif → téléphone null côté DTO", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getActiveAssociationPaymentAccount.mockResolvedValue({
      libelle: "Principal",
      titulaire: "AMAKI",
      iban: "FR1420041010050500013M02606",
      bic: "PSSTFRPP",
      codeBanque: null,
      codeGuichet: null,
      numeroCompte: null,
      cleRib: null,
      telephoneWero: null,
      weroActif: false,
    });
    const res = await getPaymentAccountRoute(
      getReq("http://localhost/api/v1/me/payment-account")
    );
    const json = await res.json();
    expect(json.data.account.weroActif).toBe(false);
    expect(json.data.account.telephoneWero).toBeNull();
  });

  it("refuse userId injecté", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getPaymentAccountRoute(
      getReq("http://localhost/api/v1/me/payment-account?userId=x")
    );
    expect(res.status).toBe(400);
  });

  it("refuse adherentId injecté", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getPaymentAccountRoute(
      getReq("http://localhost/api/v1/me/payment-account?adherentId=x")
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/me/payments/bank-transfer", () => {
  const baseFields = {
    targetType: "cotisation-mensuelle",
    targetId: "cot-1",
    amount: "20",
    paymentMethod: "Virement",
  };

  const okFile = {
    name: "preuve.pdf",
    type: "application/pdf",
    size: 1024,
    content: "%PDF",
  };

  it("401 sans auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await postBankTransferRoute(multipartReq(baseFields, okFile));
    expect(res.status).toBe(401);
  });

  it("multipart Virement OK", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockResolvedValue({
      id: "pay-1",
      montant: "20",
      moyenPaiement: "Virement",
      reference: "AMAKI-2026-COT-X",
      statut: "EnAttente",
      targetType: "cotisation-mensuelle",
      targetId: "cot-1",
      message: "Votre paiement a été enregistré et sera vérifié par l'association.",
    });
    const res = await postBankTransferRoute(multipartReq(baseFields, okFile));
    expect(res.status).toBe(200);
    expect(declareBankOrWeroPayment).toHaveBeenCalled();
    const arg = declareBankOrWeroPayment.mock.calls[0][1];
    expect(arg.paymentMethod).toBe("Virement");
    expect(arg.justificatifChemin).toMatch(/^private\/justificatifs-paiements\//);
    expect(writeFile).toHaveBeenCalled();
  });

  it("Wero OK", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockResolvedValue({
      id: "pay-2",
      montant: "15",
      moyenPaiement: "Wero",
      reference: "AMAKI-2026-COT-Y",
      statut: "EnAttente",
      targetType: "cotisation-mensuelle",
      targetId: "cot-1",
      message: "ok",
    });
    const res = await postBankTransferRoute(
      multipartReq({ ...baseFields, paymentMethod: "Wero", amount: "15" }, okFile)
    );
    expect(res.status).toBe(200);
  });

  it("montant partiel OK", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockResolvedValue({
      id: "pay-partial",
      montant: "10",
      moyenPaiement: "Virement",
      reference: "AMAKI-2026-COT-P",
      statut: "EnAttente",
      targetType: "cotisation-mensuelle",
      targetId: "cot-1",
      message: "ok",
    });
    const res = await postBankTransferRoute(
      multipartReq({ ...baseFields, amount: "10" }, okFile)
    );
    expect(res.status).toBe(200);
    expect(declareBankOrWeroPayment.mock.calls[0][1].amount).toBe("10");
  });

  it("propage amount <= 0", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockRejectedValue(
      new ServiceError("VALIDATION_ERROR", "Montant invalide")
    );
    const res = await postBankTransferRoute(
      multipartReq({ ...baseFields, amount: "0" }, okFile)
    );
    expect(res.status).toBe(400);
  });

  it("propage cible déjà soldée", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockRejectedValue(
      new ServiceError("VALIDATION_ERROR", "Cette ligne est déjà soldée")
    );
    const res = await postBankTransferRoute(multipartReq(baseFields, okFile));
    expect(res.status).toBe(400);
  });

  it("propage PAYMENT_ALREADY_PENDING → 409", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockRejectedValue(
      new ServiceError(
        "PAYMENT_ALREADY_PENDING",
        "Un paiement est déjà en attente de validation pour cette cotisation."
      )
    );
    const res = await postBankTransferRoute(multipartReq(baseFields, okFile));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("PAYMENT_ALREADY_PENDING");
  });

  it("refuse status injecté", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postBankTransferRoute(
      multipartReq(baseFields, okFile, ["status"])
    );
    expect(res.status).toBe(400);
    expect(declareBankOrWeroPayment).not.toHaveBeenCalled();
  });

  it("refuse adherentId injecté", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postBankTransferRoute(
      multipartReq(baseFields, okFile, ["adherentId"])
    );
    expect(res.status).toBe(400);
  });

  it("refuse userId injecté", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postBankTransferRoute(
      multipartReq(baseFields, okFile, ["userId"])
    );
    expect(res.status).toBe(400);
  });

  it("justificatif absent", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postBankTransferRoute(multipartReq(baseFields));
    expect(res.status).toBe(400);
  });

  it("MIME invalide", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postBankTransferRoute(
      multipartReq(baseFields, {
        name: "x.mp4",
        type: "video/mp4",
        size: 100,
      })
    );
    expect(res.status).toBe(400);
  });

  it("fichier > 10 Mo", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postBankTransferRoute(
      multipartReq(baseFields, {
        name: "big.pdf",
        type: "application/pdf",
        size: 11 * 1024 * 1024,
      })
    );
    expect(res.status).toBe(400);
  });

  it("propage montant invalide (0)", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockRejectedValue(
      new ServiceError("VALIDATION_ERROR", "Montant invalide")
    );
    const res = await postBankTransferRoute(
      multipartReq({ ...baseFields, amount: "0" }, okFile)
    );
    expect(res.status).toBe(400);
  });

  it("propage cible autre adhérent", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Cotisation introuvable")
    );
    const res = await postBankTransferRoute(
      multipartReq({ ...baseFields, targetId: "cot-B" }, okFile)
    );
    expect(res.status).toBe(404);
  });

  it("propage Wero inactif", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockRejectedValue(
      new ServiceError(
        "VALIDATION_ERROR",
        "Wero n'est pas disponible actuellement"
      )
    );
    const res = await postBankTransferRoute(
      multipartReq({ ...baseFields, paymentMethod: "Wero" }, okFile)
    );
    expect(res.status).toBe(400);
  });

  it("propage aucun compte actif", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    declareBankOrWeroPayment.mockRejectedValue(
      new ServiceError(
        "VALIDATION_ERROR",
        "Aucun compte de paiement configuré"
      )
    );
    const res = await postBankTransferRoute(multipartReq(baseFields, okFile));
    expect(res.status).toBe(400);
  });
});
