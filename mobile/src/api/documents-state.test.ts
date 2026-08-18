import { describe, expect, it } from "vitest";
import {
  buildDocumentOpenUrl,
  documentErrorMessage,
  documentTypeLabel,
  formatFileSize,
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

  it("retire le slash final de la base", () => {
    expect(
      buildDocumentOpenUrl("http://host:9052/", "/ressources/documents/a.pdf")
    ).toBe("http://host:9052/ressources/documents/a.pdf");
  });

  it("refuse /ressources/galeries/a.jpg", () => {
    expect(buildDocumentOpenUrl(base, "/ressources/galeries/a.jpg")).toBeNull();
  });

  it("refuse /ressources/justificatifs/a.pdf", () => {
    expect(
      buildDocumentOpenUrl(base, "/ressources/justificatifs/a.pdf")
    ).toBeNull();
  });

  it("refuse /ressources/../secret.pdf", () => {
    expect(buildDocumentOpenUrl(base, "/ressources/../secret.pdf")).toBeNull();
  });

  it("refuse un traversal encodé %2e%2e", () => {
    expect(
      buildDocumentOpenUrl(
        base,
        "/ressources/documents/%2e%2e/secret.pdf"
      )
    ).toBeNull();
    expect(
      buildDocumentOpenUrl(
        base,
        "/ressources/documents/%2E%2E/secret.pdf"
      )
    ).toBeNull();
  });

  it("refuse backslash, double slash, chemin vide ou base vide", () => {
    expect(buildDocumentOpenUrl(base, "/ressources/documents\\a.pdf")).toBeNull();
    expect(
      buildDocumentOpenUrl(base, "/ressources/documents//a.pdf")
    ).toBeNull();
    expect(buildDocumentOpenUrl(base, "")).toBeNull();
    expect(buildDocumentOpenUrl("", "/ressources/documents/a.pdf")).toBeNull();
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
