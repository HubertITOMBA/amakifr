/**
 * Affichage statut cotisation — mapping pur API → label FR + tone UI.
 */

export type CotisationStatusTone =
  | "success"
  | "primary"
  | "warning"
  | "danger"
  | "neutral";

export type CotisationStatusDisplay = {
  label: string;
  tone: CotisationStatusTone;
};

/**
 * Mappe le statut API vers libellé français et tone StatusBadge.
 */
export function mapCotisationStatut(statut: string): CotisationStatusDisplay {
  switch (statut) {
    case "Paye":
      return { label: "Payé", tone: "success" };
    case "EnAttente":
      return { label: "En attente", tone: "primary" };
    case "PartiellementPaye":
      return { label: "Partiellement payé", tone: "warning" };
    case "EnRetard":
      return { label: "En retard", tone: "danger" };
    default:
      return { label: statut, tone: "neutral" };
  }
}
