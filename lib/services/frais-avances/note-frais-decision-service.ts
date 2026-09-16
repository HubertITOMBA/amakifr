/**
 * Décision sur une note de frais SOUMISE (lots 2 + 4.0).
 * VALIDEE : reconnaissance de charge atomique (Depense origine FRAIS_AVANCE).
 * REJETEE : aucune Depense. Décaissement / remboursement = lots 4.1+.
 */
import { Prisma, TypeNotification } from "@prisma/client";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserDecideNoteFrais } from "@/lib/frais-avances/authz";
import {
  toNoteFraisPublicDto,
  type NoteFraisPublicDto,
} from "@/lib/frais-avances/dto";
import { hashIdForLog } from "@/lib/frais-avances/storage";
import {
  NOTES_FRAIS_TYPE_DEPENSE_ABSENT,
  findActiveTypeDepenseFraisAvance,
} from "@/lib/frais-avances/type-depense-frais-avance";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";

export type NotesFraisDecisionActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";

export const NOTES_FRAIS_DECISION_IDEMPOTENCY_CONFLICT =
  "Clé d'idempotence déjà utilisée avec un contenu de décision différent";

export { NOTES_FRAIS_TYPE_DEPENSE_ABSENT };
export type DecideNoteFraisOutcome = "VALIDEE" | "REJETEE";

export type DecideNoteFraisInput = {
  actorUserId: string;
  noteId: string;
  expectedVersion: number;
  idempotencyKey: string;
  outcome: DecideNoteFraisOutcome;
  /** Requis si VALIDEE ; ignoré / doit être absent si REJETEE. */
  montantAccepte?: number | null;
  motif?: string | null;
  client?: typeof db;
  beforeDemandeurLock?: () => Promise<void>;
  afterDemandeurLock?: () => Promise<void>;
  beforeNoteLock?: () => Promise<void>;
  afterNoteLock?: () => Promise<void>;
};

function disabledResult(): NotesFraisDecisionActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisDecisionActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    if (error.message === NOTES_FRAIS_VERSION_CONFLICT) code = "VERSION_CONFLICT";
    if (error.message === NOTES_FRAIS_DECISION_IDEMPOTENCY_CONFLICT) {
      code = "IDEMPOTENCY_CONFLICT";
    }
    if (error.message === NOTES_FRAIS_TYPE_DEPENSE_ABSENT) {
      code = "TYPE_DEPENSE_FRAIS_AVANCE_ABSENT";
    }
    if (error.message.includes("Non autorisé")) code = "FORBIDDEN";
    if (error.message.includes("Auto-décision")) code = "AUTO_DECISION_FORBIDDEN";
    return { success: false, error: error.message, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

/**
 * Normalise un montant Decimal/number en chaîne fixe 2 décimales.
 */
export function normalizeNotesFraisMontant(
  value: Prisma.Decimal | number | string | null | undefined
): string | null {
  if (value == null || value === "") return null;
  return new Prisma.Decimal(value).toFixed(2);
}

function normalizeMotif(motif: string | null | undefined): string | null {
  const t = motif?.trim() || "";
  return t.length > 0 ? t : null;
}

export type NormalizedDecisionContent = {
  statutFinal: DecideNoteFraisOutcome;
  montantAccepte: string | null;
  motif: string | null;
};

/**
 * Valide et normalise le contenu métier d'une décision.
 */
export function validateAndNormalizeDecisionContent(input: {
  outcome: DecideNoteFraisOutcome;
  montantDemande: Prisma.Decimal | number | string;
  montantAccepte?: number | null;
  motif?: string | null;
}): NormalizedDecisionContent {
  const montantDemande = new Prisma.Decimal(input.montantDemande);
  if (!(montantDemande.gt(0))) {
    throw new Error("Montant demandé invalide");
  }
  const motif = normalizeMotif(input.motif);

  if (input.outcome === "REJETEE") {
    if (!motif) {
      throw new Error("Motif obligatoire pour un rejet");
    }
    if (
      input.montantAccepte != null &&
      Number.isFinite(Number(input.montantAccepte))
    ) {
      throw new Error("Un rejet ne comporte pas de montant accepté");
    }
    return { statutFinal: "REJETEE", montantAccepte: null, motif };
  }

  if (input.outcome !== "VALIDEE") {
    throw new Error("Issue de décision invalide");
  }
  if (
    input.montantAccepte == null ||
    !Number.isFinite(Number(input.montantAccepte))
  ) {
    throw new Error("Montant accepté requis pour une validation");
  }
  const accepte = new Prisma.Decimal(input.montantAccepte);
  if (!(accepte.gt(0))) {
    throw new Error("Le montant accepté doit être strictement positif");
  }
  if (accepte.gt(montantDemande)) {
    throw new Error(
      "Le montant accepté ne peut pas dépasser le montant demandé"
    );
  }
  const isPartial = accepte.lt(montantDemande);
  if (isPartial && !motif) {
    throw new Error("Motif obligatoire pour une acceptation partielle");
  }
  return {
    statutFinal: "VALIDEE",
    montantAccepte: accepte.toFixed(2),
    motif: isPartial ? motif : motif,
  };
}

function sameDecisionContent(
  a: NormalizedDecisionContent,
  b: {
    statutFinal: string;
    montantAccepte: Prisma.Decimal | number | string | null;
    motif: string | null;
  }
): boolean {
  return (
    a.statutFinal === b.statutFinal &&
    a.montantAccepte === normalizeNotesFraisMontant(b.montantAccepte) &&
    a.motif === normalizeMotif(b.motif)
  );
}

async function loadNoteDto(
  client: typeof db,
  noteId: string
): Promise<NoteFraisPublicDto> {
  const note = await client.noteFrais.findUnique({
    where: { id: noteId },
    include: {
      Justificatifs: {
        select: {
          id: true,
          nomFichierOrig: true,
          typeMime: true,
          taille: true,
          statut: true,
          createdAt: true,
        },
      },
      Decision: true,
      Demandeur: { select: { id: true, email: true, name: true } },
      Adherent: { select: { id: true, firstname: true, lastname: true } },
    },
  });
  if (!note) throw new Error("Note introuvable");
  return toNoteFraisPublicDto(note);
}

/**
 * Décide une note SOUMISE (VALIDEE ou REJETEE).
 * Verrouillage : demandeur puis note (aligné RGPD).
 * Atomique : note + journal + (Depense FRAIS_AVANCE si VALIDEE) + notif + outbox.
 */
export async function decideNoteFrais(
  input: DecideNoteFraisInput
): Promise<
  NotesFraisDecisionActionResult<{
    note: NoteFraisPublicDto;
    alreadyDecided: boolean;
    version: number;
  }>
> {
  const client = input.client ?? db;
  try {
    assertNotesFraisEnabled();
    const key = input.idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 64) {
      throw new Error("Clé d'idempotence requise (8–64 caractères)");
    }
    if (
      !Number.isInteger(input.expectedVersion) ||
      input.expectedVersion < 1
    ) {
      throw new Error("Version de note invalide");
    }

    const byKey = await client.noteFrais.findFirst({
      where: { decisionIdempotencyKey: key },
      include: { Decision: true },
    });
    if (byKey && byKey.id !== input.noteId) {
      throw new Error("Clé d'idempotence déjà utilisée");
    }

    const existing = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      include: { Decision: true },
    });
    if (!existing) throw new Error("Note introuvable");

    if (existing.demandeurUserId === input.actorUserId) {
      throw new Error(
        "Auto-décision interdite : le décideur ne peut pas être le demandeur"
      );
    }

    const allowed = await canUserDecideNoteFrais(input.actorUserId, client);
    if (!allowed) {
      throw new Error("Non autorisé à décider une note de frais");
    }

    const previewContent = validateAndNormalizeDecisionContent({
      outcome: input.outcome,
      montantDemande: existing.montantDemande,
      montantAccepte: input.montantAccepte,
      motif: input.motif,
    });

    if (
      byKey &&
      byKey.id === input.noteId &&
      (byKey.statut === "VALIDEE" || byKey.statut === "REJETEE")
    ) {
      const journal = byKey.Decision;
      if (
        journal &&
        sameDecisionContent(previewContent, {
          statutFinal: journal.statutFinal,
          montantAccepte: journal.montantAccepte,
          motif: journal.motif,
        })
      ) {
        return {
          success: true,
          data: {
            note: await loadNoteDto(client, byKey.id),
            alreadyDecided: true,
            version: byKey.version,
          },
          message: "Déjà décidée",
        };
      }
      throw new Error(NOTES_FRAIS_DECISION_IDEMPOTENCY_CONFLICT);
    }

    if (existing.statut === "VALIDEE" || existing.statut === "REJETEE") {
      if (
        existing.decisionIdempotencyKey === key &&
        existing.Decision &&
        sameDecisionContent(previewContent, {
          statutFinal: existing.Decision.statutFinal,
          montantAccepte: existing.Decision.montantAccepte,
          motif: existing.Decision.motif,
        })
      ) {
        return {
          success: true,
          data: {
            note: await loadNoteDto(client, existing.id),
            alreadyDecided: true,
            version: existing.version,
          },
          message: "Déjà décidée",
        };
      }
      throw new Error("Note déjà décidée");
    }

    if (existing.statut !== "SOUMISE") {
      throw new Error("Seules les notes soumises peuvent être décidées");
    }

    const result = await client.$transaction(async (tx) => {
      if (input.beforeDemandeurLock) await input.beforeDemandeurLock();
      await lockUserRowForNotesFrais(tx, existing.demandeurUserId);
      if (input.afterDemandeurLock) await input.afterDemandeurLock();

      if (input.beforeNoteLock) await input.beforeNoteLock();
      await tx.$executeRaw`
        SELECT id FROM notes_frais WHERE id = ${input.noteId} FOR UPDATE
      `;
      if (input.afterNoteLock) await input.afterNoteLock();

      const current = await tx.noteFrais.findUnique({
        where: { id: input.noteId },
        include: { Decision: true },
      });
      if (!current) throw new Error("Note introuvable");

      if (current.demandeurUserId === input.actorUserId) {
        throw new Error(
          "Auto-décision interdite : le décideur ne peut pas être le demandeur"
        );
      }

      const content = validateAndNormalizeDecisionContent({
        outcome: input.outcome,
        montantDemande: current.montantDemande,
        montantAccepte: input.montantAccepte,
        motif: input.motif,
      });

      if (current.decisionIdempotencyKey === key) {
        if (
          (current.statut === "VALIDEE" || current.statut === "REJETEE") &&
          current.Decision &&
          sameDecisionContent(content, {
            statutFinal: current.Decision.statutFinal,
            montantAccepte: current.Decision.montantAccepte,
            motif: current.Decision.motif,
          })
        ) {
          return { kind: "already" as const, noteId: current.id, version: current.version };
        }
        throw new Error(NOTES_FRAIS_DECISION_IDEMPOTENCY_CONFLICT);
      }

      if (current.statut === "VALIDEE" || current.statut === "REJETEE") {
        throw new Error("Note déjà décidée");
      }
      if (current.statut !== "SOUMISE") {
        throw new Error("Seules les notes soumises peuvent être décidées");
      }
      if (current.version !== input.expectedVersion) {
        throw new Error(NOTES_FRAIS_VERSION_CONFLICT);
      }

      // Resolve-only avant claim : TypeDepense absent → rollback TX (aucune écriture).
      let typeFraisAvanceId: string | null = null;
      if (content.statutFinal === "VALIDEE") {
        const typeFa = await findActiveTypeDepenseFraisAvance(tx);
        if (!typeFa) {
          throw new Error(NOTES_FRAIS_TYPE_DEPENSE_ABSENT);
        }
        typeFraisAvanceId = typeFa.id;
      }

      const decideeAt = new Date();
      const claimed = await tx.noteFrais.updateMany({
        where: {
          id: input.noteId,
          statut: "SOUMISE",
          version: input.expectedVersion,
        },
        data: {
          statut: content.statutFinal,
          montantAccepte:
            content.montantAccepte != null
              ? new Prisma.Decimal(content.montantAccepte)
              : null,
          motifDecision: content.motif,
          decideeAt,
          decideurUserId: input.actorUserId,
          decisionIdempotencyKey: key,
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        throw new Error(NOTES_FRAIS_VERSION_CONFLICT);
      }

      await tx.noteFraisDecision.create({
        data: {
          noteFraisId: input.noteId,
          decisionIdempotencyKey: key,
          statutFinal: content.statutFinal,
          montantDemande: current.montantDemande,
          montantAccepte:
            content.montantAccepte != null
              ? new Prisma.Decimal(content.montantAccepte)
              : null,
          motif: content.motif,
          decideurUserId: input.actorUserId,
          decideeAt,
        },
      });

      // Charge reconnue (lot 4.0) : une Depense FRAIS_AVANCE / note (unicité noteFraisId).
      if (content.statutFinal === "VALIDEE" && typeFraisAvanceId) {
        const existingCharge = await tx.depense.findUnique({
          where: { noteFraisId: input.noteId },
          select: { id: true },
        });
        if (!existingCharge) {
          await tx.depense.create({
            data: {
              libelle: current.libelle.slice(0, 200),
              montant: new Prisma.Decimal(content.montantAccepte!),
              dateDepense: current.dateDepense,
              typeDepenseId: typeFraisAvanceId,
              description: current.description,
              statut: "Valide",
              origine: "FRAIS_AVANCE",
              noteFraisId: input.noteId,
              createdBy: input.actorUserId,
              validatedBy: input.actorUserId,
            },
          });
        }
      }

      const titre =
        content.statutFinal === "VALIDEE"
          ? "Note de frais validée"
          : "Note de frais rejetée";
      const message =
        content.statutFinal === "VALIDEE"
          ? content.montantAccepte ===
            normalizeNotesFraisMontant(current.montantDemande)
            ? "Votre note de frais a été acceptée pour le montant demandé."
            : `Votre note de frais a été acceptée partiellement (${content.montantAccepte} €).`
          : "Votre note de frais a été rejetée. Vous pouvez déposer une demande corrigée.";
      const lien = `/user/frais-avances/${input.noteId}`;

      await tx.notification.create({
        data: {
          userId: current.demandeurUserId,
          type: TypeNotification.Action,
          titre,
          message,
          lien,
          lue: false,
        },
      });

      await tx.noteFraisOutboxEvent.create({
        data: {
          noteFraisId: input.noteId,
          eventKey: `note:${input.noteId}:decided`,
          kind: "DECIDED",
          payload: {
            userIds: [current.demandeurUserId],
            titre,
            message,
            lien,
          },
          status: "PENDING",
        },
      });

      return {
        kind: "fresh" as const,
        noteId: input.noteId,
        version: input.expectedVersion + 1,
      };
    });

    if (result.kind === "already") {
      return {
        success: true,
        data: {
          note: await loadNoteDto(client, result.noteId),
          alreadyDecided: true,
          version: result.version,
        },
        message: "Déjà décidée",
      };
    }

    if (!input.client) {
      void import("@/lib/services/frais-avances/note-frais-service")
        .then(({ processNoteFraisOutboxOnce }) => processNoteFraisOutboxOnce())
        .catch((err) => {
          console.error("[notes-frais] outbox kick failed after decision", {
            note: hashIdForLog(result.noteId),
            err: err instanceof Error ? err.message.slice(0, 120) : "unknown",
          });
        });
    }

    return {
      success: true,
      data: {
        note: await loadNoteDto(client, result.noteId),
        alreadyDecided: false,
        version: result.version,
      },
      message:
        input.outcome === "VALIDEE" ? "Note validée" : "Note rejetée",
    };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Crée un brouillon de correction lié à une note REJETEE du même propriétaire.
 * La note rejetée reste immuable.
 */
export async function createCorrectedNoteFraisDraft(input: {
  userId: string;
  corrigeNoteFraisId: string;
  libelle?: string;
  description?: string | null;
  dateDepense?: Date;
  montantDemande?: number;
  client?: typeof db;
}): Promise<NotesFraisDecisionActionResult<{ id: string; version: number }>> {
  const client = input.client ?? db;
  try {
    assertNotesFraisEnabled();
    const rejected = await client.noteFrais.findFirst({
      where: {
        id: input.corrigeNoteFraisId,
        demandeurUserId: input.userId,
        statut: "REJETEE",
      },
    });
    if (!rejected) {
      throw new Error(
        "Note rejetée introuvable — seule une note rejetée vous appartenant peut être corrigée"
      );
    }

    const user = await client.user.findUnique({
      where: { id: input.userId },
      select: { adherent: { select: { id: true } } },
    });
    if (!user?.adherent) throw new Error("Profil adhérent requis");

    const libelle = (input.libelle ?? rejected.libelle).trim().slice(0, 200);
    if (!libelle) throw new Error("Libellé requis");
    const montant =
      input.montantDemande != null
        ? input.montantDemande
        : Number(rejected.montantDemande.toString());
    if (!(montant > 0)) {
      throw new Error("Le montant demandé doit être strictement positif");
    }

    const note = await client.$transaction(async (tx) => {
      await lockUserRowForNotesFrais(tx, input.userId);
      return tx.noteFrais.create({
        data: {
          adherentId: user.adherent!.id,
          demandeurUserId: input.userId,
          libelle,
          description:
            input.description !== undefined
              ? input.description?.trim() || null
              : rejected.description,
          dateDepense: input.dateDepense ?? rejected.dateDepense,
          montantDemande: new Prisma.Decimal(montant),
          statut: "BROUILLON",
          corrigeNoteFraisId: rejected.id,
        },
        select: { id: true, version: true },
      });
    });

    return {
      success: true,
      data: note,
      message: "Brouillon de correction créé",
    };
  } catch (error) {
    return mapError(error);
  }
}
