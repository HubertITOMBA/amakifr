import { describe, expect, it } from "vitest";
import {
  escapeHtmlText,
  htmlToPlainExcerpt,
  reunionHasLinkedRapport,
  reunionHasPublishedRapport,
  sanitizeRapportHtml,
} from "@/lib/rapports-reunion/html-excerpt";

describe("htmlToPlainExcerpt", () => {
  it("retire les balises HTML", () => {
    expect(htmlToPlainExcerpt("<p>Bonjour <strong>monde</strong></p>")).toBe(
      "Bonjour monde"
    );
  });

  it("décode les entités HTML", () => {
    expect(htmlToPlainExcerpt("<p>A &amp; B &lt; C</p>")).toBe("A & B < C");
  });

  it("exclut script et style", () => {
    const html =
      "<p>Visible</p><script>alert(1)</script><style>.x{color:red}</style><p>Suite</p>";
    const excerpt = htmlToPlainExcerpt(html);
    expect(excerpt).toBe("Visible Suite");
    expect(excerpt).not.toMatch(/alert|color:red/i);
  });

  it("contenu vide → chaîne vide", () => {
    expect(htmlToPlainExcerpt("")).toBe("");
    expect(htmlToPlainExcerpt("   ")).toBe("");
    expect(htmlToPlainExcerpt("<p></p>")).toBe("");
  });

  it("troncature propre avec ellipse", () => {
    const long = `<p>${"mot ".repeat(80)}</p>`;
    const excerpt = htmlToPlainExcerpt(long, 40);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(41);
    expect(excerpt).not.toContain("<");
  });

  it("n’interprète pas le HTML dans l’extrait", () => {
    const excerpt = htmlToPlainExcerpt(
      '<img src=x onerror="alert(1)"><p>OK</p>'
    );
    expect(excerpt).toBe("OK");
    expect(excerpt).not.toContain("<img");
  });
});

describe("reunionHasLinkedRapport / reunionHasPublishedRapport", () => {
  it("sans rapport → false", () => {
    expect(reunionHasLinkedRapport({})).toBe(false);
    expect(reunionHasLinkedRapport({ Rapport: null })).toBe(false);
    expect(reunionHasLinkedRapport({ Rapport: {} })).toBe(false);
  });

  it("avec rapport lié → true", () => {
    expect(reunionHasLinkedRapport({ Rapport: { id: "rapp_1" } })).toBe(true);
  });

  it("brouillon lié → pas visible adhérent", () => {
    expect(
      reunionHasPublishedRapport({
        Rapport: { id: "rapp_1", statut: "DRAFT" },
      })
    ).toBe(false);
    expect(
      reunionHasPublishedRapport({
        Rapport: { id: "rapp_1", statut: "PUBLISHED" },
      })
    ).toBe(true);
  });
});

describe("sanitizeRapportHtml / escapeHtmlText", () => {
  it("sanitize conserve du HTML sûr et retire les scripts", () => {
    const safe = sanitizeRapportHtml("<p>Hello</p><script>x()</script>");
    expect(safe).toContain("<p>");
    expect(safe).not.toContain("<script");
  });

  it("escapeHtmlText protège les titres d’impression", () => {
    expect(escapeHtmlText(`A <B> & "c"`)).toBe(
      "A &lt;B&gt; &amp; &quot;c&quot;"
    );
  });
});
