import { describe, expect, it } from "vitest";
import {
  buildDocumentOpenUrl,
  documentErrorMessage,
  documentTypeLabel,
  documentVisibilityBadge,
  formatFileSize,
  validateDocumentSelection,
} from "./documents-state";

describe("documentTypeLabel", () => {
  it("mappe les types connus", () => {
    expect(documentTypeLabel("PDF")).toBe("PDF");
    expect(documentTypeLabel("Video")).toBe("Vidéo");
    expect(documentTypeLabel("Image")).toBe("Image");
  });

  it("renvoie Autre pour un type inconnu", () => {
    expect(documentTypeLabel("Inconnu")).toBe("Autre");
  });
});

describe("documentVisibilityBadge", () => {
  it("Valide+Public / EnAttente / Rejeté", () => {
    expect(documentVisibilityBadge("Valide", true).label).toBe(
      "Validé · Public"
    );
    expect(documentVisibilityBadge("EnAttente", false).label).toBe("En attente");
    expect(documentVisibilityBadge("Rejete", false).label).toBe("Rejeté");
  });
});

describe("validateDocumentSelection", () => {
  it("accepte PDF et image", () => {
    expect(
      validateDocumentSelection({ mimeType: "application/pdf", size: 1000 })
    ).toEqual({ ok: true });
    expect(
      validateDocumentSelection({ mimeType: "image/jpeg", size: 1000 })
    ).toEqual({ ok: true });
  });

  it("refuse vidéo et MIME invalide", () => {
    expect(
      validateDocumentSelection({ mimeType: "video/mp4", size: 1000 }).ok
    ).toBe(false);
    expect(
      validateDocumentSelection({ mimeType: "application/msword", size: 1000 })
        .ok
    ).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("formate les octets", () => {
    expect(formatFileSize(0)).toBe("0 o");
    expect(formatFileSize(512)).toBe("512 o");
  });

  it("formate les Ko / Mo", () => {
    expect(formatFileSize(2048)).toBe("2.0 Ko");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 Mo");
  });

  it("renvoie — pour une valeur invalide", () => {
    expect(formatFileSize(-1)).toBe("—");
    expect(formatFileSize(Number.NaN)).toBe("—");
  });
});

describe("buildDocumentOpenUrl", () => {
  const base = "http://192.168.1.10:9052";

  it("accepte /ressources/documents/a.pdf", () => {
    expect(buildDocumentOpenUrl(base, "/ressources/documents/a.pdf")).toBe(
      "http://192.168.1.10:9052/ressources/documents/a.pdf"
    );
  });

  it("refuse traversal", () => {
    expect(buildDocumentOpenUrl(base, "/ressources/../secret.pdf")).toBeNull();
  });
});

describe("documentErrorMessage", () => {
  it("mappe réseau et 500", () => {
    expect(
      documentErrorMessage({ status: 0, code: "NETWORK_ERROR", message: "x" })
    ).toBe("Serveur injoignable");
    expect(
      documentErrorMessage({ status: 500, code: "INTERNAL_ERROR", message: "x" })
    ).toBe("Impossible de charger les documents");
  });
});
