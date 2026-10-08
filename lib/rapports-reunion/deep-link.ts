/**
 * Parse le paramètre deep-link `?view=<rapportId>` pour les pages rapports.
 *
 * @param search - Chaîne query ou URLSearchParams
 * @returns Identifiant du rapport, ou null si absent/vide
 */
export function parseRapportViewParam(
  search: string | URLSearchParams
): string | null {
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search
        )
      : search;
  const view = params.get("view")?.trim();
  return view || null;
}
