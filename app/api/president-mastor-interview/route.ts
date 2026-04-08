import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { PRESIDENT_MASTOR_INTERVIEW_MARKDOWN_FALLBACK } from "@/lib/president-mastor-interview-fallback";

/**
 * Chemins candidats pour trouver l'interview (production peut avoir un cwd différent)
 */
function getInterviewMdPath(): string | null {
  const cwd = process.cwd();
  const candidates = [
    // Fichier demandé
    join(cwd, "docs", "interview_Mastor.md"),
    join(cwd, "..", "docs", "interview_Mastor.md"),
    join(cwd, "..", "..", "docs", "interview_Mastor.md"),

    // Compat : ancien nom
    join(cwd, "docs", "President_Mastor.md"),
    join(cwd, "..", "docs", "President_Mastor.md"),
    join(cwd, "..", "..", "docs", "President_Mastor.md"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/**
 * Route API pour lire et parser le fichier markdown de l'interview du premier président.
 * Convertit le markdown en sections HTML structurées.
 * Si le fichier est absent, utilise un contenu de repli intégré.
 */
export async function GET() {
  try {
    const mdPath = getInterviewMdPath();
    let markdownContent: string;

    if (mdPath) {
      markdownContent = await readFile(mdPath, "utf-8");
    } else {
      markdownContent = PRESIDENT_MASTOR_INTERVIEW_MARKDOWN_FALLBACK;
    }

    const sections: Array<{ title: string; content: string }> = [];

    const expectedRubriques = [
      // Rubriques “modèle”
      "Parcours et motivations",
      "Vision et projets",
      "Gouvernance et engagement",
      "Défis et perspectives",
      "Message aux membres",

      // Rubriques réellement présentes dans interview_Mastor.md
      "Un parcours guidé par le sens du collectif",
      "Structurer et bâtir",
      "Une association en pleine évolution",
      "Des réalisations concrètes",
      "Des défis formateurs",
      "Une aventure humaine",
      "Passer le relais",
      "Regard vers l’avenir",
    ];

    const lines = markdownContent.split("\n");
    let currentSection: { title: string; content: string[] } | null = null;
    const introContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const rubriqueMatch = expectedRubriques.find((r) => {
        const escaped = r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const numberedPattern = new RegExp(`^\\d+\\.\\s*${escaped}`, "i");
        const titlePattern = new RegExp(`^${escaped}$`, "i");
        return numberedPattern.test(line) || titlePattern.test(line);
      });

      if (rubriqueMatch) {
        if (currentSection && currentSection.content.length > 0) {
          sections.push({
            title: currentSection.title,
            content: currentSection.content.join("\n"),
          });
        }
        currentSection = { title: rubriqueMatch, content: [] };
        continue;
      }

      if (currentSection) {
        if (line) currentSection.content.push(line);
      } else {
        if (line) introContent.push(line);
      }
    }

    if (currentSection && currentSection.content.length > 0) {
      sections.push({
        title: currentSection.title,
        content: currentSection.content.join("\n"),
      });
    }

    // L'introduction doit apparaître en premier (au début de page)
    if (introContent.length > 0) {
      sections.unshift({
        title: "Entretien avec le président sortant d'Amaki France",
        content: introContent.join("\n"),
      });
    }

    const convertMarkdownToHtml = (md: string): string => {
      let html = md;

      const questionPatterns = [
        /^(Pouvez-vous[^?]*\?)/i,
        /^(Qu'est-ce[^?]*\?)/i,
        /^(Quelles[^?]*\?)/i,
        /^(Quels[^?]*\?)/i,
        /^(Quelle[^?]*\?)/i,
        /^(Comment[^?]*\?)/i,
        /^(Quel[^?]*\?)/i,
        /^(Quelles sont les valeurs)/i,
        /^(Quels sont les projets prioritaires)/i,
        /^(Quelle est votre ambition)/i,
      ];

      const rawLines = html.split("\n");
      const processedLines = rawLines.map((line) => {
        const trimmed = line.trim();
        for (const pattern of questionPatterns) {
          if (pattern.test(trimmed)) return `QUESTION_MARKER:${trimmed}`;
        }
        return trimmed;
      });
      html = processedLines.join("\n");

      html = html.replace(/^(\s*)•\s+(.+)$/gm, "<li>$2</li>");

      const htmlLines = html.split("\n");
      const groupedLines: string[] = [];
      let currentList: string[] = [];

      for (const line of htmlLines) {
        if (line.trim().startsWith("<li>")) {
          currentList.push(line.trim());
        } else {
          if (currentList.length > 0) {
            groupedLines.push(`<ul>${currentList.join("")}</ul>`);
            currentList = [];
          }
          groupedLines.push(line);
        }
      }

      if (currentList.length > 0) {
        groupedLines.push(`<ul>${currentList.join("")}</ul>`);
      }

      html = groupedLines.join("\n");

      html = html.replace(/QUESTION_MARKER:(.+)/g, '<p class="question-text">$1</p>');

      html = html
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return "";
          if (trimmed.startsWith("<")) return trimmed;
          return `<p>${trimmed}</p>`;
        })
        .join("\n");

      html = html.replace(/<p><\/p>/g, "");
      html = html.replace(/<p>\s*<\/p>/g, "");

      return html;
    };

    const sectionsWithHtml = sections.map((section) => ({
      title: section.title,
      content: convertMarkdownToHtml(section.content),
    }));

    return NextResponse.json({
      success: true,
      sections: sectionsWithHtml,
    });
  } catch (error: any) {
    console.error("Erreur lors de la lecture de l'interview:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erreur lors de la lecture du fichier",
        sections: [],
      },
      { status: 500 }
    );
  }
}

