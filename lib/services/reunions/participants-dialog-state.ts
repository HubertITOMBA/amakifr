/**
 * État du dialogue participants admin — logique pure (testable hors React).
 *
 * Périmètre :
 * - Candidats « Non répondu » : adhérents **Actifs** (tous rôles) sans ligne
 *   ParticipationReunion.
 * - Réponses déjà enregistrées : **conservées** pour tous rôles, y compris
 *   comptes Inactifs (affichés avec marqueur inactif).
 * - Compteurs Présent / Absent / Excusé : comptage des lignes de statut
 *   correspondant (même source que la colonne liste quand données fraîches).
 * - Compteur Non répondu : actifs du périmètre sans réponse (pas les inactifs
 *   sans historique — ceux-ci n'apparaissent pas comme candidats).
 */

export type ParticipantUserStatus = "Actif" | "Inactif" | "Unknown";

export type ParticipantAdherentRow = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string | null;
  /** Statut compte User ; Inactif seulement via union des participations. */
  userStatus: ParticipantUserStatus;
};

export type ParticipationLike = {
  adherentId: string;
  statut: string;
  justificatifFournit?: boolean | null;
  Adherent?: {
    firstname?: string | null;
    lastname?: string | null;
    User?: {
      email?: string | null;
      role?: string | null;
      status?: string | null;
    } | null;
  } | null;
};

export type ParticipantsInitialState =
  | { kind: "absent" }
  | {
      kind: "row";
      statut: string;
      justificatifFournit: boolean;
    };

export type ParticipantsEditState = {
  statut: string;
  justificatifFournit: boolean;
};

export type ParticipationCounters = {
  presents: number;
  absents: number;
  excuses: number;
  nonRepondus: number;
};

/**
 * Texte d'aide sur le périmètre « Non répondu » (UI dialogue).
 */
export const NON_REPONDU_PERIMETER_HINT =
  "Non répondu = adhérents actifs (tous rôles) sans réponse enregistrée. Les réponses existantes (tous rôles, y compris comptes inactifs) restent visibles. Les compteurs Présent / Absent / Excusé suivent les réponses enregistrées, comme la colonne liste.";

function mapUserStatus(raw: string | null | undefined): ParticipantUserStatus {
  if (raw === "Actif") return "Actif";
  if (raw === "Inactif") return "Inactif";
  return "Unknown";
}

/**
 * Construit l'état initial du dialogue : union actifs + participations,
 * avec marquage inactif pour les fiches issues uniquement de l'historique.
 *
 * @param participations - Lignes ParticipationReunion fraîches
 * @param activeAdherents - Adhérents Actifs éligibles (tous rôles)
 */
export function buildParticipantsState(
  participations: ParticipationLike[],
  activeAdherents: Array<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    role: string | null;
    userStatus?: ParticipantUserStatus;
  }>
): {
  initial: Record<string, ParticipantsInitialState>;
  edits: Record<string, ParticipantsEditState>;
  merged: ParticipantAdherentRow[];
} {
  const byId = new Map<string, ParticipantAdherentRow>();

  for (const a of activeAdherents) {
    byId.set(a.id, {
      id: a.id,
      firstname: a.firstname,
      lastname: a.lastname,
      email: a.email,
      role: a.role,
      userStatus: a.userStatus ?? "Actif",
    });
  }

  for (const p of participations) {
    if (byId.has(p.adherentId)) continue;
    if (!p.Adherent) continue;
    byId.set(p.adherentId, {
      id: p.adherentId,
      firstname: p.Adherent.firstname ?? "",
      lastname: p.Adherent.lastname ?? "",
      email: p.Adherent.User?.email ?? "",
      role: p.Adherent.User?.role ?? null,
      userStatus: mapUserStatus(p.Adherent.User?.status),
    });
  }

  const merged = Array.from(byId.values());
  const initial: Record<string, ParticipantsInitialState> = {};
  const edits: Record<string, ParticipantsEditState> = {};

  for (const a of merged) {
    const part = participations.find((p) => p.adherentId === a.id);
    if (!part) {
      initial[a.id] = { kind: "absent" };
      edits[a.id] = { statut: "NonRepondu", justificatifFournit: false };
    } else {
      initial[a.id] = {
        kind: "row",
        statut: part.statut,
        justificatifFournit: Boolean(part.justificatifFournit),
      };
      edits[a.id] = {
        statut: part.statut,
        justificatifFournit: Boolean(part.justificatifFournit),
      };
    }
  }

  return { initial, edits, merged };
}

/**
 * Compteurs P/A/E alignés sur les réponses (comme la colonne liste).
 * Non répondu = actifs sans réponse Présent|Absent|Excuse (état édité ou initial).
 */
export function countParticipationStats(
  merged: ParticipantAdherentRow[],
  edits: Record<string, ParticipantsEditState>
): ParticipationCounters {
  return merged.reduce(
    (acc, a) => {
      const statut = edits[a.id]?.statut ?? "NonRepondu";
      if (statut === "Present") acc.presents += 1;
      else if (statut === "Absent") acc.absents += 1;
      else if (statut === "Excuse") acc.excuses += 1;
      else if (a.userStatus === "Actif" || a.userStatus === "Unknown") {
        // Inactifs sans réponse ne devraient pas être dans merged ;
        // s'ils le sont, ne pas les compter en « Non répondu » candidats.
        acc.nonRepondus += 1;
      }
      return acc;
    },
    { presents: 0, absents: 0, excuses: 0, nonRepondus: 0 }
  );
}

/**
 * Compteurs liste (colonne) à partir des participations fraîches uniquement.
 * Présent / Absent / Excusé seulement — pas de Non répondu.
 */
export function countListParticipationBadges(
  participations: Array<{ statut: string }>
): Pick<ParticipationCounters, "presents" | "absents" | "excuses"> {
  return participations.reduce(
    (acc, p) => {
      if (p.statut === "Present") acc.presents += 1;
      else if (p.statut === "Absent") acc.absents += 1;
      else if (p.statut === "Excuse") acc.excuses += 1;
      return acc;
    },
    { presents: 0, absents: 0, excuses: 0 }
  );
}

/**
 * Indique si le dialogue participants a des modifications locales non enregistrées
 * (écart edits ↔ état initial / expected serveur).
 */
export function hasUnsavedParticipantsEdits(
  initial: Record<string, ParticipantsInitialState>,
  edits: Record<string, ParticipantsEditState>
): boolean {
  const ids = new Set([...Object.keys(initial), ...Object.keys(edits)]);
  for (const id of ids) {
    const init = initial[id] ?? { kind: "absent" as const };
    const edit = edits[id] ?? {
      statut: "NonRepondu",
      justificatifFournit: false,
    };
    const initStatut = init.kind === "absent" ? "NonRepondu" : init.statut;
    const initJustif = init.kind === "absent" ? false : init.justificatifFournit;
    if (
      edit.statut !== initStatut ||
      Boolean(edit.justificatifFournit) !== Boolean(initJustif)
    ) {
      return true;
    }
  }
  return false;
}

/** Message de confirmation avant actualisation qui abandonne des edits locaux. */
export const PARTICIPANTS_REFRESH_DISCARD_MESSAGE =
  "Des modifications non enregistrées seront perdues. Continuer l'actualisation ?";

/**
 * Délai max côté UI pour le chargement du dialogue participants.
 * Le timeout débloque l'UI uniquement — il n'annule pas le POST Server Action.
 */
export const PARTICIPANTS_DIALOG_LOAD_TIMEOUT_MS = 15_000;

export const PARTICIPANTS_DIALOG_LOAD_TIMEOUT_MESSAGE =
  "Chargement des participants trop long. Réessayez ou rouvrez le dialogue.";

/** Jeton de génération lié à une réunion (ignore les réponses obsolètes). */
export type ParticipantsLoadGeneration = {
  seq: number;
  reunionId: string;
};

/**
 * Produit la génération suivante pour un chargement ciblant `reunionId`.
 */
export function nextParticipantsLoadGeneration(
  prevSeq: number,
  reunionId: string
): ParticipantsLoadGeneration {
  return { seq: prevSeq + 1, reunionId };
}

/**
 * Indique si une réponse correspond encore à la génération active.
 */
export function isParticipantsLoadGenerationCurrent(
  active: ParticipantsLoadGeneration | null,
  candidate: ParticipantsLoadGeneration
): boolean {
  if (!active) return false;
  return active.seq === candidate.seq && active.reunionId === candidate.reunionId;
}

/**
 * Course UI entre une promesse de chargement et un délai.
 * Ne propage pas d'annulation au serveur : le travail continue éventuellement.
 *
 * @param work - Promesse de chargement (Server Actions, etc.)
 * @param timeoutMs - Délai UI borné
 */
export async function raceParticipantsLoadWithTimeout<T>(
  work: Promise<T>,
  timeoutMs: number = PARTICIPANTS_DIALOG_LOAD_TIMEOUT_MS
): Promise<{ status: "ok"; value: T } | { status: "timeout" }> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ status: "timeout" }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
  });
  try {
    const raced = await Promise.race([
      work.then((value) => ({ status: "ok" as const, value })),
      timeoutPromise,
    ]);
    return raced;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
