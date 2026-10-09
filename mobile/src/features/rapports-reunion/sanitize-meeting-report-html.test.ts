import { describe, expect, it } from "vitest";
import {
  htmlToPlainText,
  isMeetingReportHtmlOversize,
  MAX_MEETING_REPORT_HTML_LENGTH,
  sanitizeHref,
  sanitizeMeetingReportHtml,
} from "@/features/rapports-reunion/sanitize-meeting-report-html";

describe("sanitizeHref", () => {
  it("autorise http/https absolus", () => {
    expect(sanitizeHref("https://amaki.fr/doc")).toBe("https://amaki.fr/doc");
    expect(sanitizeHref("http://example.com")).toMatch(/^http:\/\//);
  });

  it("refuse javascript/data/file et schémas inconnus", () => {
    expect(sanitizeHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeHref("data:text/html,x")).toBeNull();
    expect(sanitizeHref("file:///etc/passwd")).toBeNull();
    expect(sanitizeHref("vbscript:msg")).toBeNull();
  });

  it("refuse les URLs protocol-relative", () => {
    expect(sanitizeHref("//evil.example")).toBeNull();
    expect(sanitizeHref("//evil.example/path")).toBeNull();
  });

  it("refuse javascript encodé via entité &#58;", () => {
    expect(sanitizeHref("javascript&#58;alert(1)")).toBeNull();
  });

  it("refuse javascript avec entités décimale et hex pour :", () => {
    expect(sanitizeHref("javascript&#58;alert(1)")).toBeNull();
    expect(sanitizeHref("javascript&#x3a;alert(1)")).toBeNull();
    expect(sanitizeHref("javascript&#x3A;alert(1)")).toBeNull();
  });

  it("refuse la casse mixte sur schémas dangereux", () => {
    expect(sanitizeHref("JavaScript:alert(1)")).toBeNull();
    expect(sanitizeHref("JaVaScRiPt:alert(1)")).toBeNull();
    expect(sanitizeHref("DATA:text/html,x")).toBeNull();
  });

  it("accepte https en casse mixte et trim les espaces", () => {
    expect(sanitizeHref("  HTTPS://Example.COM/a  ")).toBe(
      "https://example.com/a"
    );
    expect(sanitizeHref("\nhttps://amaki.fr/x\t")).toBe("https://amaki.fr/x");
  });

  it("ne valide jamais une URL refusée (pas d’ouverture possible)", () => {
    const refused = [
      "//evil.example",
      "javascript&#58;alert(1)",
      "javascript&#x3a;alert(1)",
      " JavaScript:alert(1) ",
    ];
    for (const raw of refused) {
      expect(sanitizeHref(raw)).toBeNull();
    }
  });
});

describe("taille HTML", () => {
  it("accepte la limite exacte", () => {
    const exact = "a".repeat(MAX_MEETING_REPORT_HTML_LENGTH);
    expect(isMeetingReportHtmlOversize(exact)).toBe(false);
    expect(sanitizeMeetingReportHtml(`<p>${exact.slice(0, 10)}</p>`)).toContain(
      "<p>"
    );
    // Exacte : sanitization autorisée (contenu minimal valide)
    const padded = `<p>${"x".repeat(MAX_MEETING_REPORT_HTML_LENGTH - 7)}</p>`;
    expect(padded.length).toBe(MAX_MEETING_REPORT_HTML_LENGTH);
    expect(isMeetingReportHtmlOversize(padded)).toBe(false);
    expect(sanitizeMeetingReportHtml(padded)).toContain("<p>");
  });

  it("refuse limite+1 sans tronquer ni traiter", () => {
    const over = "b".repeat(MAX_MEETING_REPORT_HTML_LENGTH + 1);
    expect(isMeetingReportHtmlOversize(over)).toBe(true);
    expect(() => sanitizeMeetingReportHtml(over)).toThrow(
      /MEETING_REPORT_HTML_TOO_LARGE/
    );
    expect(htmlToPlainText(over)).toBe("");
  });
});

describe("sanitizeMeetingReportHtml", () => {
  it("conserve HTML TipTap autorisé", () => {
    const input =
      "<p>Bonjour <strong>monde</strong></p><ul><li>un</li></ul><h2>Titre</h2>";
    const out = sanitizeMeetingReportHtml(input);
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>");
    expect(out).toContain("<h2>");
    expect(out).toContain("Bonjour");
  });

  it("supprime script/iframe/onerror", () => {
    const input =
      '<p>x</p><script>alert(1)</script><iframe src="https://x"></iframe><img src=x onerror="alert(1)" /><p onclick="evil()">y</p>';
    const out = sanitizeMeetingReportHtml(input);
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/iframe/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/img/i);
    expect(out).toContain("<p>");
    expect(out).toContain("y");
  });

  it("refuse href javascript/data et retire le lien", () => {
    const evil =
      '<p><a href="javascript:alert(1)">clic</a> <a href="data:text/html,x">d</a></p>';
    const out = sanitizeMeetingReportHtml(evil);
    expect(out).not.toMatch(/href=/i);
    expect(out).toContain("clic");
  });

  it("refuse href protocol-relative et entités javascript", () => {
    const evil =
      '<p><a href="//evil.example">a</a><a href="javascript&#58;alert(1)">b</a></p>';
    const out = sanitizeMeetingReportHtml(evil);
    expect(out).not.toMatch(/href=/i);
    expect(out).toContain("a");
    expect(out).toContain("b");
  });

  it("conserve un lien https sûr", () => {
    const input = '<p><a href="https://amaki.fr/x">Doc</a></p>';
    const out = sanitizeMeetingReportHtml(input);
    expect(out).toContain('href="https://amaki.fr/x"');
    expect(out).toContain("Doc");
  });

  it("supprime style et CSS arbitraire", () => {
    const input =
      '<style>.x{color:red}</style><p style="color:red">a</p>';
    const out = sanitizeMeetingReportHtml(input);
    expect(out).not.toMatch(/style/i);
    expect(out).toContain("a");
  });
});

describe("htmlToPlainText", () => {
  it("produit un fallback texte sans balises", () => {
    const plain = htmlToPlainText("<p>Hello <strong>world</strong></p>");
    expect(plain).toContain("Hello");
    expect(plain).toContain("world");
    expect(plain).not.toMatch(/</);
  });
});
