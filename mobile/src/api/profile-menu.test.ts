import { describe, expect, it } from "vitest";
import {
  PROFILE_MENU_ITEMS,
  profileDetailSections,
  profileHubShowsInlineDetails,
} from "./profile-menu";
import {
  AMAKI_DATA_DELETION_LABEL,
  AMAKI_DATA_DELETION_URL,
  AMAKI_PRIVACY_LABEL,
  AMAKI_PRIVACY_URL,
} from "@/constants/amaki-links";

describe("profile-menu hub", () => {
  it("expose les 4 cards principales", () => {
    expect(PROFILE_MENU_ITEMS.map((i) => i.id)).toEqual([
      "compte",
      "identite",
      "coordonnees",
      "contact",
    ]);
  });

  it("ne montre pas les détails inline au montage", () => {
    expect(profileHubShowsInlineDetails()).toBe(false);
  });

  it("détails chargés seulement via sous-écrans", () => {
    expect(profileDetailSections()).toEqual([
      "compte",
      "identite",
      "coordonnees",
      "contact",
    ]);
  });

  it("liens publics RGPD : confidentialité et suppression-données", () => {
    expect(AMAKI_PRIVACY_URL).toBe("https://www.amaki.fr/confidentialite");
    expect(AMAKI_PRIVACY_LABEL).toBe("Politique de confidentialité");
    expect(AMAKI_DATA_DELETION_URL).toBe(
      "https://www.amaki.fr/suppression-donnees"
    );
    expect(AMAKI_DATA_DELETION_LABEL).toBe(
      "Suppression du compte et des données"
    );
    expect(AMAKI_PRIVACY_URL).not.toContain("suppression");
    expect(AMAKI_DATA_DELETION_URL).toContain("suppression-donnees");
  });
});
