/**
 * Tests unitaires lot 4.9 — politiques P1/P2/P3, DTO archive, journal snapshot.
 */
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  ARCHIVE_REIDENTIFIABILITY_NOTICE,
  computeRetentionEndsAt,
  isRetentionUsable,
  resolveEffectivePoliciesBundle,
  resolveP1FilesRetentionPolicy,
  resolveP2ArchivePriveeRetentionPolicy,
  resolveP3JournalFinancierRetentionPolicy,
} from "@/lib/frais-avances/retention-policy";
import { toNoteFraisArchivePublicDto } from "@/lib/frais-avances/dto";
import { archiveJustificatifDownloadName } from "@/lib/services/frais-avances/note-frais-archive-service";
import {
  NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT,
} from "@/lib/services/frais-avances/note-frais-journal-financier-service";

describe("politiques P1/P2/P3 (lot 4.9)", () => {
  it("allowlists vides → absent sans injection", () => {
    const env = {};
    expect(resolveP1FilesRetentionPolicy(env).status).toBe("absent");
    expect(resolveP2ArchivePriveeRetentionPolicy(env).status).toBe("absent");
    expect(resolveP3JournalFinancierRetentionPolicy(env).status).toBe("absent");
  });

  it("valeur env non listée → unvalidated", () => {
    expect(
      resolveP2ArchivePriveeRetentionPolicy({
        NOTES_FRAIS_P2_ARCHIVE_PRIVEE_RETENTION: "5y",
      }).status
    ).toBe("unvalidated");
  });

  it("injectedRetention legacy active P1=P2=P3", () => {
    const b = resolveEffectivePoliciesBundle({
      injectedRetention: { durationMs: 1000, startsAt: "archivedAt" },
    });
    expect(isRetentionUsable(b.p1)).toBe(true);
    expect(isRetentionUsable(b.p2)).toBe(true);
    expect(isRetentionUsable(b.p3)).toBe(true);
    expect(b.p3.status).toBe("validated_injected");
    if (b.p3.status === "validated_injected") {
      expect(b.p3.resolvePeriodeCle?.(new Date("2026-03-15T00:00:00Z"))).toBe(
        "2026"
      );
    }
  });

  it("computeRetentionEndsAt uniquement si injecté", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    expect(computeRetentionEndsAt(at, { status: "absent" })).toBeNull();
    const end = computeRetentionEndsAt(at, {
      status: "validated_injected",
      injected: { durationMs: 3600_000, startsAt: "archivedAt" },
    });
    expect(end?.getTime()).toBe(at.getTime() + 3600_000);
  });
});

describe("DTO archive (lot 4.9)", () => {
  it("n'expose ni chemin ni nomFichierOrig", () => {
    const dto = toNoteFraisArchivePublicDto({
      id: "a1",
      dateDepense: new Date("2026-01-02"),
      montantDemande: "10.00",
      soumiseAt: new Date("2026-01-03"),
      statutFinal: "VALIDEE",
      montantAccepte: "10.00",
      decideeAt: new Date("2026-01-04"),
      modeReglement: "REMBOURSEMENT",
      montantRemboursementChoix: "10.00",
      montantCompensationChoix: null,
      archivedAt: new Date("2026-01-05"),
      retentionEndsAt: new Date("2026-02-05"),
      reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
      Justificatifs: [
        {
          id: "j1",
          rang: 1,
          nomFichierOrig: "secret-personnel.pdf",
          typeMime: "application/pdf",
          taille: 100,
          statut: "READY",
          createdAt: new Date(),
          cheminRelatif: "archive/a1/j1.pdf",
        },
      ],
    });
    expect(dto.reidentifiabilityNotice).toBe(ARCHIVE_REIDENTIFIABILITY_NOTICE);
    expect(dto.Justificatifs[0]).toEqual(
      expect.objectContaining({
        id: "j1",
        rang: 1,
        typeMime: "application/pdf",
        statut: "READY",
      })
    );
    expect(dto.Justificatifs[0]).not.toHaveProperty("nomFichierOrig");
    expect(dto.Justificatifs[0]).not.toHaveProperty("cheminRelatif");
    expect(JSON.stringify(dto)).not.toContain("secret-personnel");
    expect(JSON.stringify(dto)).not.toContain("cheminRelatif");
  });

  it("downloadName technique", () => {
    expect(archiveJustificatifDownloadName(2, "application/pdf")).toBe(
      "justificatif-2.pdf"
    );
    expect(archiveJustificatifDownloadName(1, "image/jpeg")).toBe(
      "justificatif-1.jpg"
    );
  });
});

describe("invariants journal Decimal (lot 4.9)", () => {
  it("remboursement net >= restitutions ; montants signés", () => {
    const remb = new Prisma.Decimal("100.00");
    const corr = new Prisma.Decimal("-10.00");
    const restit = new Prisma.Decimal("20.00");
    const net = remb.plus(corr);
    expect(net.gte(restit)).toBe(true);
    expect(corr.lt(0)).toBe(true);
    expect(restit.gt(0)).toBe(true);
  });

  it("code d'incohérence stable", () => {
    expect(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT).toBe(
      "NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT"
    );
  });
});
