import { describe, expect, it } from "vitest";
import {
  RAPPEL_DETTE_DETAIL_PATH_V2,
  buildRappelDetteDetailAbsoluteUrlV2,
  resolveServerAppBaseUrl,
} from "@/lib/services/cotisations/rappel-dette/canonical-app-url";
import {
  buildRappelDetteEmailContentV2,
  escapeHtml,
  escapeHtmlAttr,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-email-content-v2";
import {
  RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT,
  RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT_V2,
  RAPPEL_DETTE_TEMPLATE_REGISTRY,
  resolveTemplateDetailLinkContract,
} from "@/lib/services/cotisations/rappel-dette/payload-fingerprint";

describe("canonical-app-url", () => {
  it("path v2 figé", () => {
    expect(RAPPEL_DETTE_DETAIL_PATH_V2).toBe(
      "/user/profile?section=cotisations&vue=toutes"
    );
  });

  it("base depuis env serveur injectable — refuse absente / invalide", () => {
    expect(
      resolveServerAppBaseUrl({ getEnvAppUrl: () => "https://amaki.fr/" })
    ).toBe("https://amaki.fr");
    expect(resolveServerAppBaseUrl({ getEnvAppUrl: () => null })).toBeNull();
    expect(
      resolveServerAppBaseUrl({ getEnvAppUrl: () => "not-a-url" })
    ).toBeNull();
  });

  it("refuse schémas hors HTTP(S) et credentials", () => {
    expect(
      resolveServerAppBaseUrl({ getEnvAppUrl: () => "javascript:alert(1)" })
    ).toBeNull();
    expect(
      resolveServerAppBaseUrl({ getEnvAppUrl: () => "data:text/html,hi" })
    ).toBeNull();
    expect(
      resolveServerAppBaseUrl({
        getEnvAppUrl: () => "https://user:pass@amaki.fr",
      })
    ).toBeNull();
    expect(
      buildRappelDetteDetailAbsoluteUrlV2({
        getEnvAppUrl: () => "ftp://amaki.fr",
      })
    ).toBeNull();
  });

  it("URL absolue = origin serveur + path catalogue (pas d’origine client)", () => {
    expect(
      buildRappelDetteDetailAbsoluteUrlV2({
        getEnvAppUrl: () => "https://amaki.fr",
      })
    ).toBe("https://amaki.fr/user/profile?section=cotisations&vue=toutes");
  });

  it("config invalide → null sans repli inventé", () => {
    expect(
      buildRappelDetteDetailAbsoluteUrlV2({ getEnvAppUrl: () => undefined })
    ).toBeNull();
    expect(
      buildRappelDetteDetailAbsoluteUrlV2({ getEnvAppUrl: () => "" })
    ).toBeNull();
  });
});

describe("catalogue v1 inchangé + v2", () => {
  it("v1 pending strictement inchangé ; v2 présent et distinct", () => {
    expect(RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT).toBe(
      "rappel-dette.detail-link.v1.pending-integration"
    );
    expect(resolveTemplateDetailLinkContract("email-rappel-dette-v1")).toBe(
      RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT
    );
    expect(resolveTemplateDetailLinkContract("email-rappel-dette-v2")).toBe(
      RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT_V2
    );
    expect(RAPPEL_DETTE_TEMPLATE_REGISTRY["email-rappel-dette-v1"]).toBe(
      RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT
    );
    expect(resolveTemplateDetailLinkContract("email-rappel-dette-v2")).not.toBe(
      RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT
    );
    expect(Object.isFrozen(RAPPEL_DETTE_TEMPLATE_REGISTRY)).toBe(true);
  });
});

describe("contenu email v2 neutre", () => {
  it("montant à la date du calcul + lien situation actuelle (sans mot snapshot)", () => {
    const content = buildRappelDetteEmailContentV2({
      detteNetteFormatted: "42,50",
      referenceDateLabel: "28/10/2026",
      salutationName: "Madame Dupont",
      resolveAppUrlOptions: { getEnvAppUrl: () => "https://amaki.fr" },
    });
    expect(content).not.toBeNull();
    expect(content!.templateVersion).toBe("email-rappel-dette-v2");
    expect(content!.subject).toMatch(/situation de cotisation/i);
    expect(content!.html).toContain("42,50");
    expect(content!.html).toContain("28/10/2026");
    expect(content!.html.toLowerCase()).not.toContain("snapshot");
    expect(content!.html).toContain("calculée à cette date");
    expect(content!.html).toContain("situation actuelle");
    expect(content!.detailAbsoluteUrl).toBe(
      "https://amaki.fr/user/profile?section=cotisations&vue=toutes"
    );
  });

  it("échec explicite si base serveur invalide (pas de lien inventé)", () => {
    expect(
      buildRappelDetteEmailContentV2({
        detteNetteFormatted: "1,00",
        referenceDateLabel: "d",
        resolveAppUrlOptions: { getEnvAppUrl: () => "javascript:alert(1)" },
      })
    ).toBeNull();
    expect(
      buildRappelDetteEmailContentV2({
        detteNetteFormatted: "1,00",
        referenceDateLabel: "d",
        resolveAppUrlOptions: { getEnvAppUrl: () => "data:text/plain,x" },
      })
    ).toBeNull();
    expect(
      buildRappelDetteEmailContentV2({
        detteNetteFormatted: "1,00",
        referenceDateLabel: "d",
        resolveAppUrlOptions: { getEnvAppUrl: () => null },
      })
    ).toBeNull();
  });

  it("pas d’override libre detailAbsoluteUrl dans l’API", () => {
    // L’input ne doit pas exposer detailAbsoluteUrl (construction serveur only)
    const keys = Object.keys({
      detteNetteFormatted: "1",
      referenceDateLabel: "d",
      resolveAppUrlOptions: { getEnvAppUrl: () => "https://amaki.fr" },
    } satisfies Parameters<typeof buildRappelDetteEmailContentV2>[0]);
    expect(keys).not.toContain("detailAbsoluteUrl");
  });
});

describe("échappement HTML des champs dynamiques", () => {
  it("escapeHtml / escapeHtmlAttr couvrent <>&\"'", () => {
    expect(escapeHtml(`A & B <C> "x"`)).toBe(
      "A &amp; B &lt;C&gt; &quot;x&quot;"
    );
    expect(escapeHtmlAttr(`O'Brien`)).toBe("O&#39;Brien");
  });

  it("contenu email échappe XSS dans salutation / date / montant", () => {
    const content = buildRappelDetteEmailContentV2({
      detteNetteFormatted: '<img src=x onerror=alert(1)>',
      referenceDateLabel: 'a</strong><script>alert(1)</script>',
      salutationName: 'A & B <C> "x"',
      resolveAppUrlOptions: { getEnvAppUrl: () => "https://amaki.fr" },
    });
    expect(content).not.toBeNull();
    expect(content!.html).not.toContain("<script>");
    expect(content!.html).toContain("&lt;script&gt;");
    expect(content!.html).not.toMatch(/<img\s/);
    expect(content!.html).toContain("&amp;");
    expect(content!.html).toContain("&quot;");
    expect(content!.html).toContain(
      'href="https://amaki.fr/user/profile?section=cotisations&amp;vue=toutes"'
    );
  });
});
