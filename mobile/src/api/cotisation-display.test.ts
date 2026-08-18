import { describe, expect, it } from "vitest";
import { mapCotisationStatut } from "@/api/cotisation-display";

describe("mapCotisationStatut", () => {
  it("mappe les statuts connus", () => {
    expect(mapCotisationStatut("Paye")).toEqual({
      label: "Payé",
      tone: "success",
    });
    expect(mapCotisationStatut("EnAttente")).toEqual({
      label: "En attente",
      tone: "primary",
    });
    expect(mapCotisationStatut("PartiellementPaye")).toEqual({
      label: "Partiellement payé",
      tone: "warning",
    });
    expect(mapCotisationStatut("EnRetard")).toEqual({
      label: "En retard",
      tone: "danger",
    });
  });

  it("statut inconnu → neutral + valeur brute", () => {
    expect(mapCotisationStatut("Custom")).toEqual({
      label: "Custom",
      tone: "neutral",
    });
  });
});
