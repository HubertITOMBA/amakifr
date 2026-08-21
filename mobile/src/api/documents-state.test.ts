import { describe, expect, it } from "vitest";
import {
  buildDocumentOpenUrl,
  documentCardAccentTone,
  documentCardDescription,
  documentCardTitle,
  documentErrorMessage,
  documentPublicationBadge,
  documentTypeLabel,
  documentValidationBadge,
  documentVisibilityBadge,
  formatFileSize,
  hasMoreDocuments,
  appendDocumentsPage,
  prependUploadedDocument,
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

describe("document card presentation", () => {
  it("titre = type, pas le nom de fichier", () => {
    expect(documentCardTitle("PDF")).toBe("PDF");
    expect(documentCardTitle("Image")).toBe("Image");
    expect(documentCardTitle("secret_1787056936718.pdf")).toBe("Autre");
  });

  it("description affichée si non vide", () => {
    expect(documentCardDescription("  Pièce d'identité  ")).toBe(
      "Pièce d'identité"
    );
  });

  it("description vide → null (pas de ligne vide)", () => {
    expect(documentCardDescription(null)).toBeNull();
    expect(documentCardDescription("")).toBeNull();
    expect(documentCardDescription("   ")).toBeNull();
  });

  it("statuts texte + publication secondaire", () => {
    expect(documentValidationBadge("EnAttente")).toEqual({
      label: "En attente",
      tone: "warning",
    });
    expect(documentValidationBadge("Valide").label).toBe("Validé");
    expect(documentValidationBadge("Rejete").label).toBe("Rejeté");
    expect(documentPublicationBadge(false).label).toBe("Privé");
    expect(documentPublicationBadge(true).label).toBe("Public");
  });

  it("accent sémantique selon statut (texte badge reste obligatoire)", () => {
    expect(documentCardAccentTone("EnAttente")).toBe("warning");
    expect(documentCardAccentTone("Valide")).toBe("success");
    expect(documentCardAccentTone("Rejete")).toBe("danger");
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

describe("pagination documents helpers", () => {
  it("hasMoreDocuments — Voir plus disparaît quand tout est chargé", () => {
    expect(hasMoreDocuments(20, 45)).toBe(true);
    expect(hasMoreDocuments(45, 45)).toBe(false);
    expect(hasMoreDocuments(0, 0)).toBe(false);
  });

  it("appendDocumentsPage — pas de doublon", () => {
    const merged = appendDocumentsPage(
      [{ id: "a" }, { id: "b" }],
      [{ id: "b" }, { id: "c" }]
    );
    expect(merged.map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  it("prependUploadedDocument — upload en tête", () => {
    const list = prependUploadedDocument(
      [{ id: "old" }],
      { id: "new" }
    );
    expect(list.map((d) => d.id)).toEqual(["new", "old"]);
  });
});
