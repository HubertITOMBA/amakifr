import { describe, expect, it } from "vitest";
import {
  DocumentCardPastel,
  documentCardPastelAccent,
  documentPublicationPastelBadge,
  documentValidationPastelBadge,
} from "./documents-card-pastel";

describe("DocumentCardPastel", () => {
  it("fonds cards très clairs (nuance, pas aplat vif)", () => {
    expect(DocumentCardPastel.waiting.cardBg).toBe("#fffcf5");
    expect(DocumentCardPastel.validated.cardBg).toBe("#f6faf7");
    expect(DocumentCardPastel.rejected.cardBg).toBe("#fdf7f7");
  });

  it("accent selon statut", () => {
    expect(documentCardPastelAccent("EnAttente").borderLeft).toBe(
      DocumentCardPastel.waiting.borderLeft
    );
    expect(documentCardPastelAccent("Valide").cardBg).toBe(
      DocumentCardPastel.validated.cardBg
    );
    expect(documentCardPastelAccent("Rejete").borderLeft).toBe(
      DocumentCardPastel.rejected.borderLeft
    );
  });

  it("badges : fond pâle + texte foncé (contraste)", () => {
    const waiting = documentValidationPastelBadge("EnAttente");
    expect(waiting.text).toBe(DocumentCardPastel.waiting.badgeText);
    expect(waiting.bg).toBe(DocumentCardPastel.waiting.badgeBg);

    const ok = documentValidationPastelBadge("Valide");
    expect(ok.text).toBe(DocumentCardPastel.validated.badgeText);

    const bad = documentValidationPastelBadge("Rejete");
    expect(bad.text).toBe(DocumentCardPastel.rejected.badgeText);

    expect(documentPublicationPastelBadge(false).text).toBe(
      DocumentCardPastel.neutral.badgeText
    );
    expect(documentPublicationPastelBadge(true).text).toBe(
      DocumentCardPastel.public.badgeText
    );
  });
});
