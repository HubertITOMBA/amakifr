import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueUser, findFirstRequest, createRequest, sendEmailMock } =
  vi.hoisted(() => ({
    findUniqueUser: vi.fn(),
    findFirstRequest: vi.fn(),
    createRequest: vi.fn(),
    sendEmailMock: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: findUniqueUser },
    dataDeletionRequest: {
      findFirst: findFirstRequest,
      create: createRequest,
    },
  },
}));

vi.mock("@/lib/mail", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

import { submitDataDeletionRequest } from "@/actions/data-deletion";

function form(email: string, message?: string) {
  const fd = new FormData();
  fd.append("email", email);
  if (message !== undefined) fd.append("message", message);
  return fd;
}

describe("submitDataDeletionRequest (public)", () => {
  beforeEach(() => {
    findUniqueUser.mockReset();
    findFirstRequest.mockReset();
    createRequest.mockReset();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("refuse un e-mail invalide sans créer de demande", async () => {
    const res = await submitDataDeletionRequest(form("pas-un-email"));
    expect(res.success).toBe(false);
    expect(createRequest).not.toHaveBeenCalled();
    expect(res).toMatchObject({ deleted: false });
  });

  it("e-mail inconnu → succès générique, aucune suppression ni création", async () => {
    findUniqueUser.mockResolvedValue(null);
    const res = await submitDataDeletionRequest(form("inconnu@example.com"));
    expect(res.success).toBe(true);
    expect(res.deleted).toBe(false);
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(String(res.message)).toMatch(/vérification d'identité/i);
    expect(String(res.message)).not.toMatch(/aucun compte/i);
  });

  it("compte existant → crée EnAttente, n'efface rien, envoie e-mails", async () => {
    findUniqueUser.mockResolvedValue({
      id: "u1",
      email: "membre@example.com",
      name: "Membre",
      adherent: null,
    });
    findFirstRequest.mockResolvedValue(null);
    createRequest.mockResolvedValue({ id: "req-1" });

    const res = await submitDataDeletionRequest(
      form("membre@example.com", "Merci")
    );

    expect(res.success).toBe(true);
    expect(res.deleted).toBe(false);
    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          statut: "EnAttente",
          message: "Merci",
        }),
      })
    );
    expect(sendEmailMock).toHaveBeenCalled();
  });

  it("demande déjà en cours → pas de doublon, succès générique", async () => {
    findUniqueUser.mockResolvedValue({
      id: "u1",
      email: "membre@example.com",
      name: "Membre",
      adherent: null,
    });
    findFirstRequest.mockResolvedValue({ id: "existing" });

    const res = await submitDataDeletionRequest(form("membre@example.com"));
    expect(res.success).toBe(true);
    expect(res.deleted).toBe(false);
    expect(createRequest).not.toHaveBeenCalled();
  });
});
