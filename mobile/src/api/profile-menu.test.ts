import { describe, expect, it } from "vitest";
import {
  PROFILE_MENU_ITEMS,
  profileDetailSections,
  profileHubShowsInlineDetails,
} from "./profile-menu";
import { AMAKI_PRIVACY_URL } from "@/constants/amaki-links";

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

  it("URL protection des données pointe vers /confidentialite", () => {
    expect(AMAKI_PRIVACY_URL).toBe("https://www.amaki.fr/confidentialite");
    expect(AMAKI_PRIVACY_URL).not.toContain("suppression");
  });
});
